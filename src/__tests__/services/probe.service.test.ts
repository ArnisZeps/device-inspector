import { getDeviceHistory } from '../../services/probe.service';
import pool from '../../db';

jest.mock('../../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

const mockProbe = {
  id: 'probe-uuid-1',
  device_id: 'device-uuid-1',
  probed_at: new Date('2026-05-31T10:00:00Z'),
  reachable: true,
  diagnostics_status: null,
  adapter_used: 'rest',
  hw_version: null,
  sw_version: null,
  fw_version: null,
  device_checksum: null,
  computed_checksum: null,
  checksum_valid: null,
  latency_ms: 42,
  attempts: 1,
  error: null,
  raw_response: null,
};

describe('getDeviceHistory service', () => {
  beforeEach(() => mockQuery.mockReset());

  it('queries with only device_id when no time filters are provided', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [mockProbe] });

    const result = await getDeviceHistory({ deviceId: 'device-uuid-1', limit: 20, offset: 0 });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM device_probes WHERE device_id = $1',
      ['device-uuid-1']
    );
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM device_probes WHERE device_id = $1 ORDER BY probed_at DESC LIMIT $2 OFFSET $3',
      ['device-uuid-1', 20, 0]
    );
    expect(result).toEqual({ data: [mockProbe], total: 1, limit: 20, offset: 0 });
  });

  it('appends from filter to both queries', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [mockProbe] });

    const from = new Date('2026-05-01T00:00:00Z');
    await getDeviceHistory({ deviceId: 'device-uuid-1', limit: 10, offset: 0, from });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM device_probes WHERE device_id = $1 AND probed_at >= $2',
      ['device-uuid-1', from]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM device_probes WHERE device_id = $1 AND probed_at >= $2 ORDER BY probed_at DESC LIMIT $3 OFFSET $4',
      ['device-uuid-1', from, 10, 0]
    );
  });

  it('appends to filter to both queries', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const to = new Date('2026-05-31T23:59:59Z');
    await getDeviceHistory({ deviceId: 'device-uuid-1', limit: 10, offset: 0, to });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM device_probes WHERE device_id = $1 AND probed_at <= $2',
      ['device-uuid-1', to]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM device_probes WHERE device_id = $1 AND probed_at <= $2 ORDER BY probed_at DESC LIMIT $3 OFFSET $4',
      ['device-uuid-1', to, 10, 0]
    );
  });

  it('appends both from and to filters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [mockProbe, mockProbe] });

    const from = new Date('2026-05-01T00:00:00Z');
    const to = new Date('2026-05-31T23:59:59Z');
    const result = await getDeviceHistory({ deviceId: 'device-uuid-1', limit: 5, offset: 10, from, to });

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM device_probes WHERE device_id = $1 AND probed_at >= $2 AND probed_at <= $3',
      ['device-uuid-1', from, to]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM device_probes WHERE device_id = $1 AND probed_at >= $2 AND probed_at <= $3 ORDER BY probed_at DESC LIMIT $4 OFFSET $5',
      ['device-uuid-1', from, to, 5, 10]
    );
    expect(result).toEqual({ data: [mockProbe, mockProbe], total: 2, limit: 5, offset: 10 });
  });

  it('returns total as integer parsed from count string', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '42' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getDeviceHistory({ deviceId: 'device-uuid-1', limit: 20, offset: 0 });

    expect(result.total).toBe(42);
  });

  it('propagates errors thrown by the pool', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(getDeviceHistory({ deviceId: 'device-uuid-1', limit: 20, offset: 0 })).rejects.toThrow(
      'DB connection failed'
    );
  });
});
