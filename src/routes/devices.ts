import { Router } from 'express';
import * as devicesController from '../controllers/devices.controller';
import { validateUuidParam } from '../middleware/validateUuid';

const router = Router();

router.post('/devices', devicesController.createDevice);
router.delete('/devices/:id', validateUuidParam, devicesController.deleteDevice);
router.patch('/devices/:id', validateUuidParam, devicesController.updateDevice);
router.get('/devices', devicesController.getDevices);
router.get('/devices/:id/history', validateUuidParam, devicesController.getDeviceHistory);
router.get('/devices/:id', validateUuidParam, devicesController.getDevice);



export default router;
