import { Router } from 'express';
import { generateOutfitController } from '../controllers/outfit.controller';

const router = Router();

// Outfit generation route
router.post('/generate-outfit', generateOutfitController);

export default router;