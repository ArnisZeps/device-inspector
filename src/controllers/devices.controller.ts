import { Request, Response, NextFunction } from 'express';
import * as devicesService from '../services/devices.service';
import * as probeService from '../services/probe.service';

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
  const connectivity_status = (req.query.connectivity_status as string | undefined)?.toUpperCase();
  const enabledRaw = req.query.enabled as string | undefined;

  if (enabledRaw !== undefined && enabledRaw !== 'true' && enabledRaw !== 'false') {
    res.status(400).json({ error: 'enabled must be boolean' });
    return;
  }

  const enabled = enabledRaw === undefined ? undefined : enabledRaw === 'true';

  try {
    const devices = await devicesService.getDevices({ connectivity_status, enabled });
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

export async function getDeviceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = req.params.id as string;

  const limitRaw = req.query.limit as string | undefined;
  const offsetRaw = req.query.offset as string | undefined;
  const fromRaw = req.query.from as string | undefined;
  const toRaw = req.query.to as string | undefined;

  const limit = limitRaw !== undefined ? parseInt(limitRaw, 10) : 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    res.status(400).json({ error: 'limit must be an integer between 1 and 100' });
    return;
  }

  const offset = offsetRaw !== undefined ? parseInt(offsetRaw, 10) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    res.status(400).json({ error: 'offset must be a non-negative integer' });
    return;
  }

  let from: Date | undefined;
  if (fromRaw !== undefined) {
    from = new Date(fromRaw);
    if (isNaN(from.getTime())) {
      res.status(400).json({ error: 'from must be a valid timestamp' });
      return;
    }
  }

  let to: Date | undefined;
  if (toRaw !== undefined) {
    to = new Date(toRaw);
    if (isNaN(to.getTime())) {
      res.status(400).json({ error: 'to must be a valid timestamp' });
      return;
    }
  }

  try {
    const device = await devicesService.getDevice({ id });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const history = await probeService.getDeviceHistory({ deviceId: id, limit, offset, from, to });
    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
}