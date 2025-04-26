export enum SubscriptionTier {
    FREE = 'free',
    BASIC = 'basic',
    PREMIUM = 'premium'
}

interface TierLimits {
    maxImageUploads: number;
    maxOutfitGenerations: number;
}

export const getSubscriptionLimits = (tier: SubscriptionTier | string): TierLimits => {
    switch (tier) {
        case SubscriptionTier.PREMIUM:
            return {
                maxImageUploads: 5000,
                maxOutfitGenerations: 2500
            };
        case SubscriptionTier.BASIC:
            return {
                maxImageUploads: 25,
                maxOutfitGenerations: 10
            };
        case SubscriptionTier.FREE:
        default:
            return {
                maxImageUploads: 8,
                maxOutfitGenerations: 3
            };
    }
};