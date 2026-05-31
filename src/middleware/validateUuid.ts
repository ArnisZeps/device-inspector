import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuidParam(req: Request, res: Response, next: NextFunction): void {
  if (!UUID_REGEX.test(req.params.id as string)) {
    res.status(400).json({ error: 'ID must be meet UUID format' });
    return;
  }
  next();
}
