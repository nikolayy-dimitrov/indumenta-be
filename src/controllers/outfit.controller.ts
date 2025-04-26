import { Request, Response } from 'express';
import { generateOutfitSuggestions } from '../services/openai.service';
import { getRemainingOutfitGenerations, incrementOutfitGenerationCounter } from "../services/usage.service";
import { SubscriptionTier } from "../services/subscription.service";
import { db } from "../config/firebase";

export const generateOutfitController = async (req: Request, res: Response) => {
    try {
        const { wardrobe, stylePreferences } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: No user found' });
        }

        // Validate input
        if (!wardrobe || !Array.isArray(wardrobe) || wardrobe.length === 0) {
            return res.status(400).json({ error: 'Valid wardrobe items are required' });
        }

        // Get user's subscription status from Firebase
        const userRef = db.collection('users').doc(req.user.uid);
        const userData = await userRef.get();
        const userProfile = userData.data();
        const subscriptionTier = userProfile?.subscriptionTier || SubscriptionTier.FREE;
        const subscriptionStatus = userProfile?.subscriptionStatus || 'expired';

        const remainingGenerations = await getRemainingOutfitGenerations(req.user.uid, subscriptionTier);

        // Check for BASIC and PREMIUM tiers, subscription must be active
        if ((subscriptionTier === SubscriptionTier.BASIC || subscriptionTier === SubscriptionTier.PREMIUM) &&
            subscriptionStatus !== 'active') {
            return res.status(400).json({
                error: 'Unauthorized',
                message: 'The request made is unauthorized due to inactive subscription status.',
                subscriptionStatus: subscriptionStatus
            });
        }

        // Check if the user has remaining outfit generations
        if (remainingGenerations <= 0) {
            return res.status(429).json({
                error: 'Weekly generation limit reached',
                message: 'You have reached your weekly outfit generation limit for your subscription tier.',
                subscriptionTier: subscriptionTier
            });
        }

        // Call the OpenAI service to generate outfit suggestions
        const outfits = await generateOutfitSuggestions(wardrobe, stylePreferences || {});

        await incrementOutfitGenerationCounter(req.user.uid);

        res.json(outfits);
    } catch (error) {
        console.error('Failed to generate outfits:', error);
        res.status(500).json({
            error: 'Failed to generate outfits.',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};