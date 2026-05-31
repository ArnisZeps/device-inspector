import { createDevice, getDevices, updateDevice } from '../../services/devices.service';
import pool from '../../db';

jest.mock('../../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

const mockDevices = [
  {
    id: 'abc-123',
    name: 'Living Room Camera',
    base_url: 'http://192.168.1.10',
    enabled: true,
    capabilities: null,
    capabilities_at: null,
    capabilities_fingerprint: null,
    current_status: 'UNKNOWN',
    consecutive_failures: 0,
    consecutive_successes: 0,
    last_checked_at: null,
    last_seen_at: null,
    last_diagnostics: null,
    created_at: new Date('2024-01-01'),
    deleted_at: null,
  },
  {
    id: 'abc-256',
    name: 'Entrance Camera',
    base_url: 'http://192.168.1.10',
    enabled: true,
    capabilities: null,
    capabilities_at: null,
    capabilities_fingerprint: null,
    current_status: 'UP',
    consecutive_failures: 0,
    consecutive_successes: 0,
    last_checked_at: null,
    last_seen_at: null,
    last_diagnostics: null,
    created_at: new Date('2024-01-01'),
    deleted_at: null,
  }
]

const mockDevice = {
  id: 'abc-123',
  name: 'Living Room Camera',
  base_url: 'http://192.168.1.10',
  enabled: true,
  capabilities: null,
  capabilities_at: null,
  capabilities_fingerprint: null,
  current_status: 'UNKNOWN',
  consecutive_failures: 0,
  consecutive_successes: 0,
  last_checked_at: null,
  last_seen_at: null,
  last_diagnostics: null,
  created_at: new Date('2024-01-01'),
  deleted_at: null,
};

describe('updateDevice service', () => {
  beforeEach(() => mockQuery.mockReset());

  it('executes the correct UPDATE query and returns the updated device', async () => {
    const updated = { ...mockDevice, enabled: false };
    mockQuery.mockResolvedValue({ rows: [updated] });

    const result = await updateDevice('abc-123', { enabled: false });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE devices'),
      ['abc-123', false],
    );
    expect(result).toEqual(updated);
  });

  it('returns null when no device matches the id', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await updateDevice('missing-id', { enabled: false });

    expect(result).toBeNull();
  });

  it('propagates errors thrown by the pool', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(updateDevice('abc-123', { enabled: false })).rejects.toThrow(
      'DB connection failed',
    );
  });
});

describe('createDevice service', () => {
  it('executes the correct INSERT query and returns the new device', async () => {
    mockQuery.mockResolvedValue({ rows: [mockDevice] });

    const result = await createDevice({ name: 'Living Room Camera', base_url: 'http://192.168.1.10' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO devices'),
      ['Living Room Camera', 'http://192.168.1.10'],
    );
    expect(result).toEqual(mockDevice);
  });

  it('propagates errors thrown by the pool', async () => {
    const error = new Error('DB connection failed');
    mockQuery.mockRejectedValue(error);

    await expect(createDevice({ name: 'Living Room Camera', base_url: 'http://192.168.1.10' })).rejects.toThrow(
      'DB connection failed',
    );
  });
});

describe('getDevices service', () => {
  beforeEach(() => mockQuery.mockReset());

  it('queries with only deleted_at IS NULL when no filters are provided', async () => {
    mockQuery.mockResolvedValue({ rows: mockDevices });

    const result = await getDevices({});

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM devices WHERE deleted_at IS NULL',
      [],
    );
    expect(result).toEqual(mockDevices);
  });

  it('filters by status when status is provided', async () => {
    mockQuery.mockResolvedValue({ rows: [mockDevices[1]] });

    const result = await getDevices({ status: 'UP' });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM devices WHERE deleted_at IS NULL AND status = $1',
      ['UP'],
    );
    expect(result).toEqual([mockDevices[1]]);
  });

  it('filters by enabled when enabled is provided', async () => {
    mockQuery.mockResolvedValue({ rows: mockDevices });

    await getDevices({ enabled: true });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM devices WHERE deleted_at IS NULL AND enabled = $1',
      [true],
    );
  });

  it('filters by both status and enabled', async () => {
    mockQuery.mockResolvedValue({ rows: [mockDevices[1]] });

    await getDevices({ status: 'UP', enabled: true });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM devices WHERE deleted_at IS NULL AND status = $1 AND enabled = $2',
      ['UP', true],
    );
  });

  it('propagates errors thrown by the pool', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(getDevices({})).rejects.toThrow('DB connection failed');
  });
});
