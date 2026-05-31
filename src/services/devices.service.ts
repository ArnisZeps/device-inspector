import pool from '../db';

interface CreateDeviceInput {
  address: string;
  protocol: string;
}

interface UpdateDeviceInput {
  address?: string;
  protocol?: string;
  status?: string;
  enabled?: boolean;
}

interface Device {
  id: string;
  address: string;
  protocol: string;
  status: string;
  enabled: boolean;
  created_at: Date;
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<Device | null> {
  const patchableFields = ['address', 'protocol', 'status', 'enabled'] as const;
  const entries = (Object.keys(input) as (keyof UpdateDeviceInput)[])
    .filter(key => patchableFields.includes(key) && input[key] !== undefined);

  const setClauses = entries.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const values = entries.map(key => input[key]);

  const result = await pool.query(
    `UPDATE devices SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] ?? null;
}

export async function createDevice(input: CreateDeviceInput): Promise<Device> {
  const { address, protocol } = input;
  const result = await pool.query(
    `INSERT INTO devices (address, protocol)
     VALUES ($1, $2)
     RETURNING *`,
    [address, protocol]
  );
  return result.rows[0];
}
