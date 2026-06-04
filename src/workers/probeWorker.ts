import cron from 'node-cron';
import { getDevicesForProbing, updateDeviceProtocols, saveProbeResult, ProbeDevice, ProbeResult } from '../services/probe.service';
import { ConnectivityStatus } from '../services/devices.service';
import { probeGrpc } from './grpcClient';
import { probeRest } from './restClient';
import { computeChecksum } from '../services/checksum.service';


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
  grpcPort?: number;
}

type HealthCheckResult = HealthUnreachable | HealthError | HealthOk;

const MAX_HEALTH_RETRIES = 3;
const HEALTH_TIMEOUT_MS = 5000;

export async function checkHealth(device: ProbeDevice): Promise<HealthCheckResult> {
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_HEALTH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${device.base_url}/health`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
      console.log(`${device.name} health attempt ${attempt}/${MAX_HEALTH_RETRIES} failed: ${lastError}`);
      continue;
    }

    if (!res.ok) {
      return { outcome: ConnectivityStatus.ERROR, error: `HTTP ${res.status}`, attempts: attempt };
    }

    try {
      const health = await res.json() as { protocols: string[]; grpc_port?: number };
      const protocols = health.protocols ?? [];
      await updateDeviceProtocols(device.id, protocols);
      return { outcome: ConnectivityStatus.ONLINE, protocols, grpcPort: health.grpc_port };
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
    const host = new URL(device.base_url).hostname;
    const grpcAddress = `${host}:${health.grpcPort}`;
    return probeGrpc(device.name, grpcAddress, device.id);
  }

  return probeRest(device.name, device.base_url);
}

async function runProbeRound(): Promise<void> {
  const devices = await getDevicesForProbing();
  console.log(`Launching probes for ${devices.length} device(s)`);

  await Promise.allSettled(
    devices.map(async (device) => {
      const result = await probeDevice(device);
      if (result.reachable && result.raw_response) {
        const computed = await computeChecksum(JSON.stringify(result.raw_response));
        result.computed_checksum = computed;
        if (computed !== null) result.checksum_valid = computed === result.device_checksum;
      }
      await saveProbeResult(device.id, result);
      console.log(`${device.name} (${device.base_url}): reachable=${result.reachable}, diagnostics=${result.diagnostics_status ?? 'n/a'}`);
    })
  );
}

export function start(): void {
  const schedule = process.env.PROBE_CRON_SCHEDULE ?? '* * * * *';
  console.log(`Probe worker started with schedule: ${schedule}`);
  cron.schedule(schedule, () => {
    runProbeRound().catch((err) => console.error('Probe round failed:', err));
  });
}
