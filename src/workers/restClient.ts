import { ProbeResult } from '../services/probe.service';

interface DiagnosticsResponse {
  hw_version: string;
  sw_version: string;
  fw_version: string;
  status: string;
  checksum: string;
}

const MAX_PROBE_ATTEMPTS = 3;
const PROBE_TIMEOUT_MS = 15000;

export async function probeRest(deviceName: string, baseUrl: string): Promise<ProbeResult> {
  let lastError = '';
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_PROBE_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/diagnostics`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
      console.log(`${deviceName} REST probe attempt ${attempt}/${MAX_PROBE_ATTEMPTS} failed: ${lastError}`);
      continue;
    }

    const basePayload = { reachable: true, durationMs: Date.now() - start, attempts: attempt, adapter_used: 'rest', computed_checksum: null };

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ...basePayload, diagnostics_status: 'ERROR', device_checksum: '', error: `HTTP ${res.status}`, raw_response: body || undefined };
    }

    let diag: DiagnosticsResponse;
    try {
      diag = await res.json() as DiagnosticsResponse;
    } catch {
      return { ...basePayload, diagnostics_status: 'ERROR', device_checksum: '', error: 'Invalid response body' };
    }

    return {
      ...basePayload,
      diagnostics_status: diag.status,
      device_checksum: diag.checksum,
      hw_version: diag.hw_version,
      sw_version: diag.sw_version,
      fw_version: diag.fw_version,
      raw_response: diag,
    };
  }

  return {
    reachable: false,
    diagnostics_status: null,
    durationMs: Date.now() - start,
    attempts: MAX_PROBE_ATTEMPTS,
    adapter_used: 'rest',
    device_checksum: '',
    computed_checksum: null,
    error: lastError,
  };
}
