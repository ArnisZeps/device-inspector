import { Request, Response, NextFunction } from 'express';
import { createDevice, getDevice, getDeviceHistory, getDevices, updateDevice } from '../../controllers/devices.controller';
import * as devicesService from '../../services/devices.service';
import * as probeService from '../../services/probe.service';

jest.mock('../../db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../services/devices.service');
jest.mock('../../services/probe.service');

const mockDevice = {
  id: 'abc-123',
  name: 'Living Room Camera',
  base_url: 'http://192.168.1.10',
  enabled: true,
  protocols: [],
  protocols_discovered: null,
  connectivity_status: 'UNKNOWN',
  diagnostics_status: null,
  last_checked_at: null,
  last_seen_at: null,
  created_at: new Date('2024-01-01'),
  deleted_at: null,
};

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('updateDevice controller', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
  });

  it('returns 400 when no valid fields are provided', async () => {
    const req = { params: { id: 'abc-123' }, body: {} } as unknown as Request;

    await updateDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No valid fields provided for update' });
  });

  it('returns 404 when the device does not exist', async () => {
    (devicesService.updateDevice as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: { enabled: false } } as unknown as Request;

    await updateDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Device not found' });
  });

  it('returns 200 with the updated device on success', async () => {
    const updated = { ...mockDevice, enabled: false };
    (devicesService.updateDevice as jest.Mock).mockResolvedValue(updated);
    const req = { params: { id: 'abc-123' }, body: { enabled: false } } as unknown as Request;

    await updateDevice(req, res as Response, next);

    expect(devicesService.updateDevice).toHaveBeenCalledWith('abc-123', expect.objectContaining({ enabled: false }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('calls next with the error when the service throws', async () => {
    const error = new Error('DB connection failed');
    (devicesService.updateDevice as jest.Mock).mockRejectedValue(error);
    const req = { params: { id: 'abc-123' }, body: { enabled: false } } as unknown as Request;

    await updateDevice(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('createDevice controller', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
  });

  it('returns 400 when name is missing', async () => {
    const req = { body: { base_url: 'http://192.168.1.10' } } as Request;

    await createDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required fields',
      missing: ['name'],
    });
  });

  it('returns 400 when base_url is missing', async () => {
    const req = { body: { name: 'Living Room Camera' } } as Request;

    await createDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required fields',
      missing: ['base_url'],
    });
  });

  it('returns 400 when both fields are missing', async () => {
    const req = { body: {} } as Request;

    await createDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required fields',
      missing: ['name', 'base_url'],
    });
  });

  it('returns 201 with the created device on success', async () => {
    (devicesService.createDevice as jest.Mock).mockResolvedValue(mockDevice);
    const req = { body: { name: 'Living Room Camera', base_url: 'http://192.168.1.10' } } as Request;

    await createDevice(req, res as Response, next);

    expect(devicesService.createDevice).toHaveBeenCalledWith({
      name: 'Living Room Camera',
      base_url: 'http://192.168.1.10',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockDevice);
  });

  it('calls next with the error when the service throws', async () => {
    const error = new Error('DB connection failed');
    (devicesService.createDevice as jest.Mock).mockRejectedValue(error);
    const req = { body: { name: 'Living Room Camera', base_url: 'http://192.168.1.10' } } as Request;

    await createDevice(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getDevices controller', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
  });

  it('returns 400 when enabled query param is not "true" or "false"', async () => {
    const req = { query: { enabled: 'yes' } } as unknown as Request;

    await getDevices(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'enabled must be boolean' });
  });

  it('returns 200 with all devices when no filters are provided', async () => {
    (devicesService.getDevices as jest.Mock).mockResolvedValue([mockDevice]);
    const req = { query: {} } as unknown as Request;

    await getDevices(req, res as Response, next);

    expect(devicesService.getDevices).toHaveBeenCalledWith({ connectivity_status: undefined, enabled: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([mockDevice]);
  });

  it('passes parsed connectivity_status and enabled filters to the service', async () => {
    (devicesService.getDevices as jest.Mock).mockResolvedValue([mockDevice]);
    const req = { query: { connectivity_status: 'ONLINE', enabled: 'true' } } as unknown as Request;

    await getDevices(req, res as Response, next);

    expect(devicesService.getDevices).toHaveBeenCalledWith({ connectivity_status: 'ONLINE', enabled: true });
  });

  it('calls next with the error when the service throws', async () => {
    const error = new Error('DB connection failed');
    (devicesService.getDevices as jest.Mock).mockRejectedValue(error);
    const req = { query: {} } as unknown as Request;

    await getDevices(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getDeviceHistory controller', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  const mockHistory = {
    data: [],
    total: 0,
    limit: 20,
    offset: 0,
  };

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
    (devicesService.getDevice as jest.Mock).mockResolvedValue(mockDevice);
    (probeService.getDeviceHistory as jest.Mock).mockResolvedValue(mockHistory);
  });

  it('returns 200 with history on success', async () => {
    const req = { params: { id: 'abc-123' }, query: {} } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(probeService.getDeviceHistory).toHaveBeenCalledWith({ deviceId: 'abc-123', limit: 20, offset: 0, from: undefined, to: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockHistory);
  });

  it('returns 404 when device does not exist', async () => {
    (devicesService.getDevice as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 'abc-123' }, query: {} } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Device not found' });
  });

  it('returns 400 when limit is out of range', async () => {
    const req = { params: { id: 'abc-123' }, query: { limit: '200' } } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'limit must be an integer between 1 and 100' });
  });

  it('returns 400 when limit is not a number', async () => {
    const req = { params: { id: 'abc-123' }, query: { limit: 'abc' } } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'limit must be an integer between 1 and 100' });
  });

  it('returns 400 when offset is negative', async () => {
    const req = { params: { id: 'abc-123' }, query: { offset: '-1' } } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'offset must be a non-negative integer' });
  });

  it('returns 400 when from is not a valid timestamp', async () => {
    const req = { params: { id: 'abc-123' }, query: { from: 'not-a-date' } } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'from must be a valid timestamp' });
  });

  it('returns 400 when to is not a valid timestamp', async () => {
    const req = { params: { id: 'abc-123' }, query: { to: 'not-a-date' } } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'to must be a valid timestamp' });
  });

  it('passes parsed limit, offset, from, and to to the service', async () => {
    const req = {
      params: { id: 'abc-123' },
      query: { limit: '10', offset: '5', from: '2026-05-01T00:00:00Z', to: '2026-05-31T23:59:59Z' },
    } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(probeService.getDeviceHistory).toHaveBeenCalledWith({
      deviceId: 'abc-123',
      limit: 10,
      offset: 5,
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-05-31T23:59:59Z'),
    });
  });

  it('calls next with error when service throws', async () => {
    const error = new Error('DB connection failed');
    (probeService.getDeviceHistory as jest.Mock).mockRejectedValue(error);
    const req = { params: { id: 'abc-123' }, query: {} } as unknown as Request;

    await getDeviceHistory(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getDevice controller', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
  });

  it('returns 200 with the device on success', async () => {
    (devicesService.getDevice as jest.Mock).mockResolvedValue(mockDevice);
    const req = { params: { id: 'abc-123' } } as unknown as Request;

    await getDevice(req, res as Response, next);

    expect(devicesService.getDevice).toHaveBeenCalledWith({ id: 'abc-123' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockDevice);
  });

  it('returns 404 when the device does not exist', async () => {
    (devicesService.getDevice as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 'abc-123' } } as unknown as Request;

    await getDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Device not found' });
  });

  it('calls next with the error when the service throws', async () => {
    const error = new Error('DB connection failed');
    (devicesService.getDevice as jest.Mock).mockRejectedValue(error);
    const req = { params: { id: 'abc-123' } } as unknown as Request;

    await getDevice(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
