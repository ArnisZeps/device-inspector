import pool from '../db';

export interface ProbeDevice {
  id: string;
  name: string;
  base_url: string;
}

export interface ProbeResult {
  adapter_used: string;
  reachable: boolean;
  status: string;
  durationMs: number;
  device_checksum: string;
  computed_checksum: string | null;
  checksum_valid?: boolean;
  hw_version?: string;
  sw_version?: string;
  fw_version?: string;
  error?: string;
  raw_response?: unknown;
}

export async function getDevicesForProbing(): Promise<ProbeDevice[]> {
  const result = await pool.query<ProbeDevice>(
    `SELECT id, name, base_url FROM devices WHERE enabled = TRUE AND deleted_at IS NULL`
  );
  return result.rows;
}

export async function saveProbeResult(deviceId: string, result: ProbeResult): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO device_probes
         (device_id, reachable, status, adapter_used, hw_version, sw_version, fw_version,
          device_checksum, computed_checksum, checksum_valid, latency_ms, error, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        deviceId,
        result.reachable,
        result.status,
        result.adapter_used,
        result.hw_version ?? null,
        result.sw_version ?? null,
        result.fw_version ?? null,
        result.device_checksum ?? null,
        result.computed_checksum ?? null,
        result.checksum_valid ?? null,
        result.durationMs,
        result.error ?? null,
        result.raw_response ? JSON.stringify(result.raw_response) : null,
      ]
    );

    const success = result.reachable && result.status === 'ok';
    const deviceStatus = result.reachable ? result.status : 'offline';

    await client.query(
      `UPDATE devices SET
         status                = $2,
         last_checked_at       = now(),
         last_seen_at          = CASE WHEN $3 THEN now() ELSE last_seen_at END,
         consecutive_failures  = CASE WHEN $4 THEN 0 ELSE consecutive_failures + 1 END,
         consecutive_successes = CASE WHEN $4 THEN consecutive_successes + 1 ELSE 0 END
       WHERE id = $1`,
      [deviceId, deviceStatus, result.reachable, success]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
