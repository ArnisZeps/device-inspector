import { Request, Response, NextFunction } from 'express';
import * as devicesService from '../services/devices.service';

export async function updateDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = req.params.id as string;
  const { address, protocol, status, enabled } = req.body;
  const updates = { address, protocol, status, enabled };

  const hasUpdate = Object.values(updates).some(v => v !== undefined);
  if (!hasUpdate) {
    res.status(400).json({ error: 'No valid fields provided for update' });
    return;
  }

  try {
    const device = await devicesService.updateDevice(id, updates);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.status(200).json(device);
  } catch (err) {
    next(err);
  }
}

export async function createDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const missing = (['address', 'protocol'] as const).filter(field => !req.body[field]);
  if (missing.length > 0) {
    res.status(400).json({ error: 'Missing required fields', missing });
    return;
  }

  const { address, protocol } = req.body;

  try {
    const device = await devicesService.createDevice({ address, protocol });
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}
