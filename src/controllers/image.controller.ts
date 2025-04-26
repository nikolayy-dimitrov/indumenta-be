import { Request, Response } from 'express';
import { analyzeImage } from '../services/image.service';
import { getRemainingImageUploads, incrementImageUploadCounter } from "../services/usage.service";
import { db } from "../config/firebase";
import { SubscriptionTier } from "../services/subscription.service";

export const analyzeImageController = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: No user found' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Get user's subscription status from Firebase
        const userRef = db.collection('users').doc(req.user.uid);
        const userData = await userRef.get();
        const userProfile = userData.data();
        const subscriptionTier = userProfile?.subscriptionTier || SubscriptionTier.FREE;
        const subscriptionStatus = userProfile?.subscriptionStatus || 'expired';

        // Check remaining uploads based on subscription
        const remainingUploads = await getRemainingImageUploads(req.user.uid, subscriptionTier);

        // Check for BASIC and PREMIUM tiers, subscription must be active
        if ((subscriptionTier === SubscriptionTier.BASIC || subscriptionTier === SubscriptionTier.PREMIUM) &&
            subscriptionStatus !== 'active') {
            return res.status(400).json({
                error: 'Unauthorized',
                message: 'The request made is unauthorized due to inactive subscription status.',
                subscriptionStatus: subscriptionStatus
            });
        }

        // Check if the user has remaining uploads
        if (remainingUploads <= 0) {
            return res.status(429).json({
                error: 'Weekly upload limit reached',
                message: 'You have reached your weekly image upload limit for your subscription tier.',
                subscriptionTier: subscriptionTier
            });
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