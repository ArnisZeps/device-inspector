import { Request, Response, NextFunction } from 'express';
import * as devicesService from '../services/devices.service';

export async function createDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { address, protocol, polling_interval } = req.body;

  if (!address || !protocol || polling_interval == null) {
    res.status(400).json({ error: 'address, protocol, and polling_interval are required' });
    return;
  }

  try {
    const device = await devicesService.createDevice({ address, protocol, polling_interval });
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}
