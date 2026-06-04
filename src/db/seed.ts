import pool from './index';

const MOCK_BASE_URLS = [
  'http://mock-devices:9001',
  'http://mock-devices:9002',
  'http://mock-devices:9003',
  'http://mock-devices:9004',
];

async function seed(): Promise<void> {
  for (const base_url of MOCK_BASE_URLS) {
    let name: string;
    let protocols: string[];

    try {
      const res = await fetch(`${base_url}/health`);
      const body = await res.json() as { name: string; protocols: string[] };
      name = body.name;
      protocols = body.protocols ?? [];
    } catch (err) {
      console.warn(`Could not reach ${base_url}, skipping: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const result = await pool.query(
      `INSERT INTO devices (name, base_url, protocols, protocols_discovered)
       SELECT $1, $2, $3, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM devices WHERE name = $1 AND deleted_at IS NULL
       )`,
      [name, base_url, protocols]
    );

    if (result.rowCount) {
      console.log(`Seeded: ${name} (${protocols.join(', ')})`);
    } else {
      console.log(`Skipped (already exists): ${name}`);
    }
  }
}

seed()
  .then(() => {
    console.log('Seed complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
