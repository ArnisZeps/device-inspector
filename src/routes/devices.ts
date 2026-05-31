import { Router } from 'express';
import * as devicesController from '../controllers/devices.controller';

const router = Router();

router.post('/devices', devicesController.createDevice);
router.patch('/devices/:id', devicesController.updateDevice);
router.get('/devices', devicesController.getDevices);


export default router;
