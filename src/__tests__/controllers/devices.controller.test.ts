import { Request, Response, NextFunction } from 'express';
import { createDevice, updateDevice } from '../../controllers/devices.controller';
import * as devicesService from '../../services/devices.service';

jest.mock('../../db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../services/devices.service');

const mockDevice = {
  id: 'abc-123',
  address: '192.168.1.10',
  protocol: 'http',
  status: 'pending',
  enabled: true,
  created_at: new Date('2024-01-01'),
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
    const req = { params: { id: 'missing' }, body: { status: 'active' } } as unknown as Request;

    await updateDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Device not found' });
  });

  it('returns 200 with the updated device on success', async () => {
    const updated = { ...mockDevice, status: 'active' };
    (devicesService.updateDevice as jest.Mock).mockResolvedValue(updated);
    const req = { params: { id: 'abc-123' }, body: { status: 'active' } } as unknown as Request;

    await updateDevice(req, res as Response, next);

    expect(devicesService.updateDevice).toHaveBeenCalledWith('abc-123', expect.objectContaining({ status: 'active' }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('calls next with the error when the service throws', async () => {
    const error = new Error('DB connection failed');
    (devicesService.updateDevice as jest.Mock).mockRejectedValue(error);
    const req = { params: { id: 'abc-123' }, body: { status: 'active' } } as unknown as Request;

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

  it('returns 400 when address is missing', async () => {
    const req = { body: { protocol: 'http' } } as Request;

    await createDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required fields',
      missing: ['address'],
    });
  });

  it('returns 400 when protocol is missing', async () => {
    const req = { body: { address: '192.168.1.10' } } as Request;

    await createDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required fields',
      missing: ['protocol'],
    });
  });

  it('returns 400 when both fields are missing', async () => {
    const req = { body: {} } as Request;

    await createDevice(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required fields',
      missing: ['address', 'protocol'],
    });
  });

  it('returns 201 with the created device on success', async () => {
    (devicesService.createDevice as jest.Mock).mockResolvedValue(mockDevice);
    const req = { body: { address: '192.168.1.10', protocol: 'http' } } as Request;

    await createDevice(req, res as Response, next);

    expect(devicesService.createDevice).toHaveBeenCalledWith({
      address: '192.168.1.10',
      protocol: 'http',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockDevice);
  });

  it('calls next with the error when the service throws', async () => {
    const error = new Error('DB connection failed');
    (devicesService.createDevice as jest.Mock).mockRejectedValue(error);
    const req = { body: { address: '192.168.1.10', protocol: 'http' } } as Request;

    await createDevice(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
