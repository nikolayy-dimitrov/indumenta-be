import { db } from '../config/firebase';
import firebase from 'firebase-admin';
import { getSubscriptionLimits } from "./subscription.service";

interface UsageCounter {
    imageUploads: number;
    outfitGenerations: number;
    weekStartTimestamp: number;
}

/**
 * Gets the timestamp for the start of the current week (Monday 00:00:00)
 */
export const getCurrentWeekStartTimestamp = (): number => {
    const now = new Date();
    const day = now.getDay() || 7;
    const diff = now.getDate() - day + 1;

    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    return monday.getTime();
};

/**
 * Initialize or reset usage counter
 */
export const initializeUsageCounter = (): UsageCounter => {
    return {
        imageUploads: 0,
        outfitGenerations: 0,
        weekStartTimestamp: getCurrentWeekStartTimestamp()
    };
};

/**
 * Get current usage counter for a user, initializing or resetting if necessary
 */
export const getUserUsageCounter = async (userId: string): Promise<UsageCounter> => {
    try {
        const userRef = db.collection('users').doc(userId);
        const userData = await userRef.get();

        const user = userData.data();
        const usageCounter = user?.usageCounter as UsageCounter;

        if (!userData.exists || !usageCounter || usageCounter.weekStartTimestamp < getCurrentWeekStartTimestamp()) {
            const newCounter = initializeUsageCounter();
            await userRef.set({ usageCounter: newCounter }, { merge: true });
            return newCounter;
        }

        return usageCounter;
    } catch (error) {
        console.error('Error getting usage counter:', error);
        throw new Error('Failed to get usage counter');
    }
};

/**
 * Increment image upload counter for a user
 */
export const incrementImageUploadCounter = async (userId: string): Promise<UsageCounter> => {
    try {
        const userRef = db.collection('users').doc(userId);
        let counter = await getUserUsageCounter(userId);

        counter = {
            ...counter,
            imageUploads: counter.imageUploads + 1
        };

        await userRef.update({
            'usageCounter.imageUploads': firebase.firestore.FieldValue.increment(1)
        });

        return counter;
    } catch (error) {
        console.error('Error incrementing image upload counter:', error);
        throw new Error('Failed to update image upload counter');
    }
};

/**
 * Increment outfit generation counter for a user
 */
export const incrementOutfitGenerationCounter = async (userId: string): Promise<UsageCounter> => {
    try {
        const userRef = db.collection('users').doc(userId);
        let counter = await getUserUsageCounter(userId);

        counter = {
            ...counter,
            outfitGenerations: counter.outfitGenerations + 1
        };

        await userRef.update({
            'usageCounter.outfitGenerations': firebase.firestore.FieldValue.increment(1)
        });

        return counter;
    } catch (error) {
        console.error('Error incrementing outfit generation counter:', error);
        throw new Error('Failed to update outfit generation counter');
    }
};

/**
 * Get user's remaining uploads for the current week
 * @param userId User ID
 * @param subscriptionTier User's Subscription Tier
 */
export const getRemainingImageUploads = async (userId: string, subscriptionTier: string): Promise<number> => {
    const counter = await getUserUsageCounter(userId);
    const limits = getSubscriptionLimits(subscriptionTier);
    return Math.max(0, limits.maxImageUploads - counter.imageUploads);
};

/**
 * Get user's remaining outfit generations for the current week
 * @param userId User ID
 * @param subscriptionTier User's Subscription Tier
 */
export const getRemainingOutfitGenerations = async (userId: string, subscriptionTier: string): Promise<number> => {
    const counter = await getUserUsageCounter(userId);
    const limits = getSubscriptionLimits(subscriptionTier);
    return Math.max(0, limits.maxOutfitGenerations - counter.outfitGenerations);
};