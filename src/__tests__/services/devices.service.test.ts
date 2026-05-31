import { createDevice, updateDevice } from '../../services/devices.service';
import pool from '../../db';

jest.mock('../../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

const mockDevice = {
  id: 'abc-123',
  address: '192.168.1.10',
  protocol: 'http',
  status: 'pending',
  enabled: true,
  created_at: new Date('2024-01-01'),
};

describe('updateDevice service', () => {
  beforeEach(() => mockQuery.mockReset());

  it('executes the correct UPDATE query and returns the updated device', async () => {
    const updated = { ...mockDevice, status: 'active' };
    mockQuery.mockResolvedValue({ rows: [updated] });

    const result = await updateDevice('abc-123', { status: 'active' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE devices'),
      ['abc-123', 'active'],
    );
    expect(result).toEqual(updated);
  });

  it('returns null when no device matches the id', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await updateDevice('missing-id', { status: 'active' });

    expect(result).toBeNull();
  });

  it('propagates errors thrown by the pool', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(updateDevice('abc-123', { status: 'active' })).rejects.toThrow(
      'DB connection failed',
    );
  });
});

describe('createDevice service', () => {
  it('executes the correct INSERT query and returns the new device', async () => {
    mockQuery.mockResolvedValue({ rows: [mockDevice] });

    const result = await createDevice({ address: '192.168.1.10', protocol: 'http' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO devices'),
      ['192.168.1.10', 'http'],
    );
    expect(result).toEqual(mockDevice);
  });

  it('propagates errors thrown by the pool', async () => {
    const error = new Error('DB connection failed');
    mockQuery.mockRejectedValue(error);

    await expect(createDevice({ address: '192.168.1.10', protocol: 'http' })).rejects.toThrow(
      'DB connection failed',
    );
  });
});
