import { Router } from 'express';
import { upload } from '../config/multer';
import { analyzeImageController, rekognitionAnalyzeRedirect } from '../controllers/image.controller';
import { authenticateUser } from "../middlewares/auth.middleware";

const router = Router();

// Image analysis route
router.post('/analyze', authenticateUser, upload.single('image') , analyzeImageController);

// Backward compatibility route
router.post('/rekognition-analyze', rekognitionAnalyzeRedirect);

export default router;