import { Request, Response } from 'express';
import { analyzeImage } from '../services/image.service';
import { incrementImageUploadCounter } from "../services/usage.service";

export const analyzeImageController = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: No user found' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Get the image buffer from the uploaded file
        const imageBytes = req.file.buffer;

        // Call the image analysis service
        const analysisResult = await analyzeImage(imageBytes);

        await incrementImageUploadCounter(req.user.uid);

        res.json({
            success: true,
            ...analysisResult,
        });
    } catch (error) {
        console.error('Error analyzing image:', error);
        res.status(500).json({
            error: 'Error analyzing image',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// Redirect handler for the rekognition-analyze endpoint
export const rekognitionAnalyzeRedirect = async (req: Request, res: Response) => {
    try {
        res.redirect(307, '/api/images/analyze');
    } catch (error) {
        console.error('Error in rekognition redirect:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};