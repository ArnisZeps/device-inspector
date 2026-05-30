import pool from '../db';

interface CreateDeviceInput {
  address: string;
  protocol: string;
}

interface Device {
  id: string;
  address: string;
  protocol: string;
  status: string;
  enabled: boolean;
  created_at: Date;
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
