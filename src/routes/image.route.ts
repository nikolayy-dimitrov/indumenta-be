import { Router } from 'express';
import { analyzeImageController, rekognitionAnalyzeRedirect } from '../controllers/image.controller';
import { upload } from '../config/multer';

const router = Router();

// Image analysis route
router.post('/analyze', upload.single('image'), analyzeImageController);

// Backward compatibility route
router.post('/rekognition-analyze', rekognitionAnalyzeRedirect);

export default router;