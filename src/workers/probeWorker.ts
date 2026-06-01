import cron from 'node-cron';
import { getDevicesForProbing, updateDeviceProtocols, saveProbeResult, ProbeDevice, ProbeResult } from '../services/probe.service';

const PROTOCOL_TTL_MS = 10 * 60 * 1000;

async function discoverProtocols(device: ProbeDevice): Promise<string[]> {
  let healthRes: Response;
  try {
    healthRes = await fetch(`${device.base_url}/health`);
  } catch (err) {
    console.log(`${device.name} protocol discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    return device.protocols;
  }

  try {
    const health = await healthRes.json() as { protocols: string[] };
    const protocols = health.protocols ?? [];
    await updateDeviceProtocols(device.id, protocols);
    return protocols;
  } catch (err) {
    console.error(`${device.name} protocol discovery response error:`, err);
    return device.protocols;
  }
}

const MAX_ATTEMPTS = 3;
const PROBE_TIMEOUT_MS = 15000;

async function probeDevice(device: ProbeDevice): Promise<ProbeResult> {
  const isStale = !device.protocols_discovered ||
    Date.now() - new Date(device.protocols_discovered).getTime() > PROTOCOL_TTL_MS;
  const protocols = isStale ? await discoverProtocols(device) : device.protocols;
  const adapter_used = protocols.includes('grpc') ? 'grpc' : 'rest';

  let lastError = '';
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${device.base_url}/diagnostics`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
      console.log(`${device.name} probe attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError}`);
      continue;
    }

    const durationMs = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { reachable: true, status: 'error', durationMs, attempts: attempt, adapter_used, device_checksum: '', computed_checksum: null, error: `HTTP ${res.status}`, raw_response: body || undefined };
    }

    let diag: { hw_version: string; sw_version: string; fw_version: string; status: string; checksum: string };
    try {
      diag = await res.json() as typeof diag;
    } catch {
      return { reachable: true, status: 'error', durationMs, attempts: attempt, adapter_used, device_checksum: '', computed_checksum: null, error: 'Invalid response body' };
    }

    return { reachable: true, status: diag.status, durationMs, attempts: attempt, adapter_used, hw_version: diag.hw_version, sw_version: diag.sw_version, fw_version: diag.fw_version, device_checksum: diag.checksum, computed_checksum: null, raw_response: diag };
  }

  return { reachable: false, status: 'offline', durationMs: Date.now() - start, attempts: MAX_ATTEMPTS, adapter_used, device_checksum: '', computed_checksum: null, error: lastError };
}

async function runProbeRound(): Promise<void> {
  const devices = await getDevicesForProbing();
  console.log(`Launching probes for ${devices.length} device(s)`);

  await Promise.allSettled(
    devices.map(async (device) => {
      const result = await probeDevice(device);
      await saveProbeResult(device.id, result);
      console.log(`${device.name} (${device.base_url}): ${result.status}`);
    })
  );
}

export function start(): void {
  console.log('Probe worker started, running every minute');
  cron.schedule('* * * * *', () => {
    runProbeRound().catch((err) => console.error('Probe round failed:', err));
  });
}
