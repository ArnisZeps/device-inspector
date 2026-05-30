import { Router } from 'express';
import * as devicesController from '../controllers/devices.controller';

const router = Router();

router.post('/devices', devicesController.createDevice);

export default router;
