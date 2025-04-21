export interface WardrobeItem {
    id: string;
    category: string;
    subCategory?: string;
    vibe?: string;
    season: string;
    dominantColor: string;
    imageUrl: string;
}

export interface StylePreferences {
    color?: string;
    occasion?: string;
}

export interface OutfitPieces {
    Top: string;
    Bottom: string;
    Shoes: string;
}

export interface OutfitSuggestion {
    outfit_id: string;
    outfit_pieces: OutfitPieces;
    match: number;
}

export interface OutfitResponse {
    outfits: OutfitSuggestion[];
}

export interface SubscriptionDetails {
    hasSubscription: boolean;
    subscriptionStatus?: string;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
}