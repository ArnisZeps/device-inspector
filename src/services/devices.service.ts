import pool from '../db';

export enum ConnectivityStatus {
  UNKNOWN = 'UNKNOWN',
  ONLINE = 'ONLINE',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
  ERROR = 'ERROR',
}

interface CreateDeviceInput {
  name: string;
  base_url: string;
}

interface UpdateDeviceInput {
  name?: string;
  base_url?: string;
  enabled?: boolean;
}

interface GetDevicesInput {
  connectivity_status?: string;
  enabled?: boolean;
}

interface GetDeviceInput {
  id: string;
}

interface Device {
  id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  protocols: string[];
  protocols_discovered: Date | null;
  connectivity_status: ConnectivityStatus;
  diagnostics_status: string | null;
  last_checked_at: Date | null;
  last_seen_at: Date | null;
  created_at: Date;
  deleted_at: Date | null;
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<Device | null> {
  const patchableFields = ['name', 'base_url', 'enabled'] as const;
  const entries = (Object.keys(input) as (keyof UpdateDeviceInput)[])
    .filter(key => patchableFields.includes(key) && input[key] !== undefined);

  const setClauses = entries.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const values = entries.map(key => input[key]);

  const result = await pool.query(
    `UPDATE devices SET ${setClauses} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] ?? null;
}

export async function createDevice(input: CreateDeviceInput): Promise<Device> {
  const { name, base_url } = input;
  const result = await pool.query(
    `INSERT INTO devices (name, base_url)
     VALUES ($1, $2)
     RETURNING *`,
    [name, base_url]
  );
  return result.rows[0];
}

export async function getDevices(input: GetDevicesInput): Promise<Device[]> {
  const filterableFields = ['connectivity_status', 'enabled'] as const;

  const entries = (Object.keys(input) as (keyof GetDevicesInput)[])
    .filter(key => filterableFields.includes(key) && input[key] !== undefined);

  const conditions = ['deleted_at IS NULL'];
  const values: unknown[] = [];

  entries.forEach((key, i) => {
    conditions.push(`${key} = $${i + 1}`);
    values.push(input[key]);
  });

  const result = await pool.query<Device>(
    `SELECT * FROM devices WHERE ${conditions.join(' AND ')}`,
    values
  );

  return result.rows;
}

export async function getDevice(input: GetDeviceInput) {
  const { id } = input;
  
  const result = await pool.query<Device>(
    `SELECT * FROM devices WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )

  return result.rows[0] ?? null;
}