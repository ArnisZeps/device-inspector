import cron from 'node-cron';
import { getDevicesForProbing, saveProbeResult, ProbeDevice, ProbeResult } from '../services/probe.service';

async function probeDevice(device: ProbeDevice): Promise<ProbeResult> {
  // TODO: implement probe against device.base_url
  return { reachable: true, status: "ok", durationMs: 120, device_checksum: "checksum_abc123", computed_checksum: null, adapter_used: 'rest' };
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
