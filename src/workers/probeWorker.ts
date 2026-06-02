import cron from 'node-cron';
import { getDevicesForProbing, updateDeviceProtocols, saveProbeResult, ProbeDevice, ProbeResult } from '../services/probe.service';
import { ConnectivityStatus } from '../services/devices.service';

interface DiagnosticsResponse {
  hw_version: string;
  sw_version: string;
  fw_version: string;
  status: string;
  checksum: string;
}

interface HealthUnreachable {
  outcome: ConnectivityStatus.DOWN;
  error: string;
  attempts: number;
}

interface HealthError {
  outcome: ConnectivityStatus.ERROR;
  error: string;
  attempts: number;
}

interface HealthOk {
  outcome: ConnectivityStatus.ONLINE;
  protocols: string[];
}

type HealthCheckResult = HealthUnreachable | HealthError | HealthOk;

const MAX_HEALTH_RETRIES = 3;
const MAX_PROBE_ATTEMPTS = 3;
const PROBE_TIMEOUT_MS = 15000;

export async function checkHealth(device: ProbeDevice): Promise<HealthCheckResult> {
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_HEALTH_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${device.base_url}/health`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.log(`${device.name} health attempt ${attempt}/${MAX_HEALTH_RETRIES} failed: ${lastError}`);
      continue;
    }

    if (!res.ok) {
      return { outcome: ConnectivityStatus.ERROR, error: `HTTP ${res.status}`, attempts: attempt };
    }

    try {
      const health = await res.json() as { protocols: string[] };
      const protocols = health.protocols ?? [];
      await updateDeviceProtocols(device.id, protocols);
      return { outcome: ConnectivityStatus.ONLINE, protocols };
    } catch (err) {
      return { outcome: ConnectivityStatus.ERROR, error: 'Invalid health response body', attempts: attempt };
    }
  }

  return { outcome: ConnectivityStatus.DOWN, error: lastError, attempts: MAX_HEALTH_RETRIES };
}

export async function probeDevice(device: ProbeDevice): Promise<ProbeResult> {
  const health = await checkHealth(device);

  if (health.outcome === ConnectivityStatus.DOWN) {
    return {
      reachable: false,
      diagnostics_status: null,
      durationMs: 0,
      attempts: health.attempts,
      adapter_used: 'rest',
      device_checksum: '',
      computed_checksum: null,
      error: health.error,
    };
  }

  if (health.outcome === ConnectivityStatus.ERROR) {
    return {
      reachable: true,
      diagnostics_status: 'ERROR',
      durationMs: 0,
      attempts: health.attempts,
      adapter_used: 'rest',
      device_checksum: '',
      computed_checksum: null,
      error: health.error,
    };
  }

  const adapter_used = health.protocols.includes('grpc') ? 'grpc' : 'rest';

  if (adapter_used === 'grpc') {
    // TODO: gRPC diagnostics probe
  }

  let lastError = '';
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_PROBE_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${device.base_url}/diagnostics`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
      console.log(`${device.name} probe attempt ${attempt}/${MAX_PROBE_ATTEMPTS} failed: ${lastError}`);
      continue;
    }

    const basePayload = { reachable: true, durationMs: Date.now() - start, attempts: attempt, adapter_used, computed_checksum: null };

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { 
        ...basePayload,
        diagnostics_status: 'ERROR', 
        device_checksum: '', 
        error: `HTTP ${res.status}`, 
        raw_response: body || undefined };
      }

    let diag: DiagnosticsResponse;
    try {
      diag = await res.json() as DiagnosticsResponse;
    } catch {
      return { 
        ...basePayload, 
        diagnostics_status: 'ERROR', 
        device_checksum: '', 
        error: 'Invalid response body' };
    }

    return { 
      ...basePayload, 
      diagnostics_status: 
      diag.status, device_checksum: diag.checksum, 
      hw_version: diag.hw_version, 
      sw_version: diag.sw_version, 
      fw_version: diag.fw_version, 
      raw_response: diag 
    };
  }

  return {
    reachable: false,
    diagnostics_status: null,
    durationMs: Date.now() - start,
    attempts: MAX_PROBE_ATTEMPTS,
    adapter_used,
    device_checksum: '',
    computed_checksum: null,
    error: lastError,
  };
}

async function runProbeRound(): Promise<void> {
  const devices = await getDevicesForProbing();
  console.log(`Launching probes for ${devices.length} device(s)`);

  await Promise.allSettled(
    devices.map(async (device) => {
      const result = await probeDevice(device);
      await saveProbeResult(device.id, result);
      console.log(`${device.name} (${device.base_url}): reachable=${result.reachable}, diagnostics=${result.diagnostics_status ?? 'n/a'}`);
    })
  );
}

export function start(): void {
  console.log('Probe worker started, running every minute');
  cron.schedule('* * * * *', () => {
    runProbeRound().catch((err) => console.error('Probe round failed:', err));
  });
}
