import { spawn } from 'child_process';

const BINARY_PATH = process.env.CHECKSUM_BINARY_PATH;

if (!BINARY_PATH) {
  console.warn('CHECKSUM_BINARY_PATH not set — checksum validation disabled');
}

export async function computeChecksum(input: string): Promise<string | null> {
  if (!BINARY_PATH) return null;

  return new Promise((resolve) => {
    const proc = spawn(BINARY_PATH);
    let stdout = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      resolve(code === 0 ? stdout.trim() : null);
      if (code !== 0) console.error(`Checksum binary exited with code ${code}`);
    });

    proc.on('error', (err) => {
      console.error('Checksum binary error:', err.message);
      resolve(null);
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}
