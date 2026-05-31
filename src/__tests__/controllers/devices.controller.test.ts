import { Request, Response, NextFunction } from 'express';
import { createDevice, updateDevice } from '../../controllers/devices.controller';
import * as devicesService from '../../services/devices.service';

jest.mock('../../db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../services/devices.service');

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
