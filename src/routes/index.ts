import { Router } from 'express';
import devicesRouter from './devices';
import healthRouter from './health';

const router = Router();

router.use('/api', devicesRouter);
router.use('/', healthRouter);

export default router;
