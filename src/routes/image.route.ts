import { Router } from 'express';

import { analyzeImageController } from '../controllers/image.controller';
import { authenticateUser } from "../middlewares/auth.middleware";

const router = Router();

router.post('/analyze', authenticateUser, analyzeImageController);

export default router;