import { Request, Response } from 'express';

import { GetSignedUrlConfig } from "@google-cloud/storage";

import { analyzeImage } from '../services/image.service';
import { getRemainingImageUploads, incrementImageUploadCounter } from "../services/usage.service";
import { SubscriptionTier } from "../services/subscription.service";
import { db, storage } from "../config/firebase";

interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email?: string;
    };
    doc?: {
        id: string;
    };
}

interface UserProfile {
    subscriptionTier: SubscriptionTier;
    subscriptionStatus: string;
    emailVerified?: boolean;
    lastLogin?: Date;
    createdAt?: Date;
}

/**
 * Controller for analyzing images with OpenAI's GPT API
 * Handles user authentication, subscription checks, and rate limiting
 */
export const analyzeImageController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(404).json({ error: 'Unauthorized: No user found' });
        }

        const { imagePath, docId } = req.body;

        if (!imagePath || !docId) {
            return res.status(400).json({ error: 'No imagePath/docId provided in request body' });
        }

        const userRef = db.collection('users').doc(req.user.uid);
        const userData = await userRef.get();

        if (!userData.exists) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User profile not found.'
            });
            return;
        }

        const userProfile = userData.data() as UserProfile;
        const subscriptionTier = userProfile?.subscriptionTier || SubscriptionTier.FREE;
        const subscriptionStatus = userProfile?.subscriptionStatus || 'expired';

        if ((subscriptionTier === SubscriptionTier.BASIC || subscriptionTier === SubscriptionTier.PREMIUM) &&
            subscriptionStatus !== 'active') {
            return res.status(400).json({
                error: 'Unauthorized',
                message: 'The request made is unauthorized due to inactive subscription status.',
                subscriptionStatus: subscriptionStatus
            });
        }

        const remainingUploads = await getRemainingImageUploads(req.user.uid, subscriptionTier);

        if (remainingUploads <= 0) {
            return res.status(429).json({
                error: 'Weekly upload limit reached',
                message: 'You have reached your weekly image upload limit for your subscription tier.',
                subscriptionTier: subscriptionTier
            });
        }

        const bucket = storage.bucket();
        const file = bucket.file(imagePath);
        const [exists] = await file.exists();

        if (!exists) {
            return res.status(404).json({
                error: 'File not found',
                message: 'The specified image file does not exist in storage.',
                imagePath
            });
        }

        const urlOptions: GetSignedUrlConfig = {
            version: "v4",
            action: "read",
            expires: Date.now() + 1000 * 60 * 3,
        }

        const [signedUrl] = await file.getSignedUrl(urlOptions);

        try {
            const response = await fetch(signedUrl, { method: 'HEAD' });
            if (!response.ok) {
                return res.status(500).json({
                    error: 'Image URL not accessible',
                    message: 'Generated signed URL is not accessible',
                    statusCode: response.status
                });
            }
        } catch (urlError) {
            return res.status(500).json({
                error: 'URL accessibility test failed',
                message: 'Could not verify URL accessibility'
            });
        }

        const analysisResult = await analyzeImage(signedUrl);

        const docRef = db.collection("clothes").doc(docId);
        await docRef.update({
            analysis: analysisResult,
            status: "complete"
        })

        await incrementImageUploadCounter(req.user.uid);

        res.json({
            success: true,
            ...analysisResult,
        });

    } catch (error) {

        if (error instanceof Error) {
            if (error.message.includes('Bucket name not specified')) {
                return res.status(500).json({
                    error: 'Storage configuration error',
                    message: 'Firebase Storage bucket not properly configured'
                });
            }

            if (error.message.includes('invalid_image_url')) {
                return res.status(400).json({
                    error: 'Invalid image URL',
                    message: 'OpenAI could not access the image URL. Please try again.'
                });
            }
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while analyzing the image',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        });
    }
};
