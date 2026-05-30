import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  status?: number;
}

function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
}

export default errorHandler;
