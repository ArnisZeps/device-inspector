import pool from '../db';
import { ConnectivityStatus } from './devices.service';

export interface DeviceProbe {
  id: string;
  device_id: string;
  probed_at: Date;
  reachable: boolean;
  diagnostics_status: string | null;
  adapter_used: string | null;
  hw_version: string | null;
  sw_version: string | null;
  fw_version: string | null;
  device_checksum: string | null;
  computed_checksum: string | null;
  checksum_valid: boolean | null;
  latency_ms: number | null;
  attempts: number;
  error: string | null;
  raw_response: unknown;
}

export interface DeviceHistoryResult {
  data: DeviceProbe[];
  total: number;
  limit: number;
  offset: number;
}

interface GetDeviceHistoryInput {
  deviceId: string;
  limit: number;
  offset: number;
  from?: Date;
  to?: Date;
}

export interface ProbeDevice {
  id: string;
  name: string;
  base_url: string;
  protocols: string[];
  protocols_discovered: Date | null;
}

export interface ProbeResult {
  adapter_used: string;
  reachable: boolean;
  diagnostics_status: string | null;
  durationMs: number;
  attempts: number;
  device_checksum: string;
  computed_checksum: string | null;
  checksum_valid?: boolean;
  hw_version?: string;
  sw_version?: string;
  fw_version?: string;
  error?: string;
  raw_response?: unknown;
}

export async function getDeviceHistory(input: GetDeviceHistoryInput): Promise<DeviceHistoryResult> {
  const { deviceId, limit, offset, from, to } = input;

  const conditions: string[] = ['device_id = $1'];
  const values: unknown[] = [deviceId];
  let paramIdx = 2;

  if (from !== undefined) {
    conditions.push(`probed_at >= $${paramIdx++}`);
    values.push(from);
  }
  if (to !== undefined) {
    conditions.push(`probed_at <= $${paramIdx++}`);
    values.push(to);
  }

  const whereClause = conditions.join(' AND ');

  const [countResult, dataResult] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM device_probes WHERE ${whereClause}`,
      values
    ),
    pool.query<DeviceProbe>(
      `SELECT * FROM device_probes WHERE ${whereClause} ORDER BY probed_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, limit, offset]
    ),
  ]);

  return {
    data: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    limit,
    offset,
  };
}

export async function getDevicesForProbing(): Promise<ProbeDevice[]> {
  const result = await pool.query<ProbeDevice>(
    `SELECT id, name, base_url, protocols, protocols_discovered FROM devices WHERE enabled = TRUE AND deleted_at IS NULL`
  );
  return result.rows;
}

export async function updateDeviceProtocols(deviceId: string, protocols: string[]): Promise<void> {
  await pool.query(
    `UPDATE devices SET protocols = $2, protocols_discovered = now() WHERE id = $1`,
    [deviceId, protocols]
  );
}

export async function saveProbeResult(deviceId: string, result: ProbeResult): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO device_probes
         (device_id, reachable, diagnostics_status, adapter_used,
          hw_version, sw_version, fw_version, device_checksum, computed_checksum,
          checksum_valid, latency_ms, attempts, error, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        deviceId,
        result.reachable,
        result.diagnostics_status,
        result.adapter_used,
        result.hw_version ?? null,
        result.sw_version ?? null,
        result.fw_version ?? null,
        result.device_checksum ?? null,
        result.computed_checksum ?? null,
        result.checksum_valid ?? null,
        result.durationMs,
        result.attempts,
        result.error ?? null,
        result.raw_response ? JSON.stringify(result.raw_response) : null,
      ]
    );

    await client.query(
      `UPDATE devices SET
         diagnostics_status  = $2::TEXT,
         connectivity_status = (
           SELECT CASE
             WHEN COUNT(*) FILTER (WHERE NOT reachable) >= 5 THEN '${ConnectivityStatus.DOWN}'
             WHEN COUNT(*) FILTER (WHERE NOT reachable) >= 1 THEN '${ConnectivityStatus.DEGRADED}'
             ELSE '${ConnectivityStatus.ONLINE}'
           END
           FROM (
             SELECT reachable FROM device_probes
             WHERE device_id = $1
             ORDER BY probed_at DESC
             LIMIT 5
           ) recent
         ),
         last_checked_at     = now(),
         last_seen_at        = CASE WHEN $3 THEN now() ELSE last_seen_at END
       WHERE id = $1`,
      [deviceId, result.diagnostics_status, result.reachable]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
