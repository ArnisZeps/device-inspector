import { Request, Response, NextFunction } from 'express';
import * as devicesService from '../services/devices.service';

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
