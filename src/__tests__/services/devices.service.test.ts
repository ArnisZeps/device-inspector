import { createDevice } from '../../services/devices.service';
import pool from '../../db';

jest.mock('../../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

const mockDevice = {
  id: 'abc-123',
  address: '192.168.1.10',
  protocol: 'mqtt',
  status: 'pending',
  enabled: true,
  created_at: new Date('2024-01-01'),
};

describe('createDevice service', () => {
  it('executes the correct INSERT query and returns the new device', async () => {
    mockQuery.mockResolvedValue({ rows: [mockDevice] });

    const result = await createDevice({ address: '192.168.1.10', protocol: 'mqtt' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO devices'),
      ['192.168.1.10', 'mqtt'],
    );
    expect(result).toEqual(mockDevice);
  });

  it('propagates errors thrown by the pool', async () => {
    const error = new Error('DB connection failed');
    mockQuery.mockRejectedValue(error);

    await expect(createDevice({ address: '192.168.1.10', protocol: 'mqtt' })).rejects.toThrow(
      'DB connection failed',
    );
  });
});
