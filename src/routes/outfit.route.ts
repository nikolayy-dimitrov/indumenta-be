import { Router } from 'express';
import { generateOutfitController } from '../controllers/outfit.controller';
import { authenticateUser } from "../middlewares/auth.middleware";

const router = Router();

// Outfit generation route
router.post('/generate-outfit', authenticateUser, generateOutfitController);

export default router;