import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.DB_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: Number(process.env.POSTGRES_PORT),
});

async function verifyConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

verifyConnection();

export default pool;