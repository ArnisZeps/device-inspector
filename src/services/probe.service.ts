import pool from '../db';

export interface ProbeDevice {
  id: string;
  name: string;
  base_url: string;
}

export interface ProbeResult {
  success: boolean;
  statusCode?: number;
  durationMs?: number;
  error?: string;
}

export async function getDevicesForProbing(): Promise<ProbeDevice[]> {
  const result = await pool.query<ProbeDevice>(
    `SELECT id, name, base_url FROM devices WHERE enabled = TRUE AND deleted_at IS NULL`
  );
  return result.rows;
}

export async function saveProbeResult(_deviceId: string, _result: ProbeResult): Promise<void> {
  // TODO: persist probe result to database
}
