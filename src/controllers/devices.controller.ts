import { Request, Response, NextFunction } from 'express';
import * as devicesService from '../services/devices.service';

export async function updateDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = req.params.id as string;
  const { name, base_url, enabled } = req.body;
  const updates = { name, base_url, enabled };

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
  const missing = (['name', 'base_url'] as const).filter(field => !req.body[field]);
  if (missing.length > 0) {
    res.status(400).json({ error: 'Missing required fields', missing });
    return;
  }

  const { name, base_url } = req.body;

  try {
    const device = await devicesService.createDevice({ name, base_url });
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}

export async function getDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  const status = req.query.status as string | undefined;
  const enabledRaw = req.query.enabled as string | undefined;

  if (enabledRaw !== undefined && enabledRaw !== 'true' && enabledRaw !== 'false') {
    res.status(400).json({ error: 'enabled must be boolean' });
    return;
  }

  const enabled = enabledRaw === undefined ? undefined : enabledRaw === 'true';

  try {
    const devices = await devicesService.getDevices({ status, enabled });
    res.status(200).json(devices);
  } catch (err) {
    next(err);
  }
}

export async function getDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = req.params.id as string;

  try {
    const device = await devicesService.getDevice({ id });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.status(200).json(device);
  } catch (err) {
    next(err);
  }
}