import cron from 'node-cron';
import { getDevicesForProbing, saveProbeResult, ProbeDevice, ProbeResult } from '../services/probe.service';

async function probeDevice(device: ProbeDevice): Promise<ProbeResult> {
  // TODO: implement probe against device.base_url
  return { success: true };
}

async function runProbeRound(): Promise<void> {
  const devices = await getDevicesForProbing();
  console.log(`Launching probes for ${devices.length} device(s)`);

  await Promise.allSettled(
    devices.map(async (device) => {
      const result = await probeDevice(device);
      await saveProbeResult(device.id, result);
      console.log(`${device.name} (${device.base_url}): ${result.success}`);
    })
  );
}

export function start(): void {
  console.log('Probe worker started, running every minute');
  cron.schedule('* * * * *', () => {
    runProbeRound().catch((err) => console.error('Probe round failed:', err));
  });
}
