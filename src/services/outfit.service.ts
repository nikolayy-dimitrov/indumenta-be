import { Type } from "@google/genai";

import { genAI } from '../config/gemini';
import { CacheType, PROMPT, SYSTEM_INSTRUCTIONS } from "../constants/prompts";

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
    season?: string;
}

interface OutfitPieces {
    top: string,
    bottom: string,
    shoes: string
}

export interface GeneratedOutfit {
    outfitId: string;
    outfitPieces: OutfitPieces,
    match: number
}

export const generateOutfitSuggestions = async (wardrobe: WardrobeItem[], stylePreferences: StylePreferences): Promise<GeneratedOutfit[]> => {
    const fullPrompt = `
        ${PROMPT[CacheType.OUTFIT_GENERATION]}
    
        ### User Preferences:
        ${stylePreferences.color ? `- **Color Preference:** ${stylePreferences.color}` : ''}
        ${stylePreferences.occasion ? `- **Occasion:** ${stylePreferences.occasion}` : ''}
        ${stylePreferences.season ? `**Season** ${stylePreferences.season}` : ''}
        
        ### Wardrobe Items:
        ${wardrobe.map((item) =>
        `- Item ${item.id}: { Category: ${item.category}, ${item.subCategory ? `Subcategory: ${item.subCategory},` : ''} ${item.vibe ? `Vibe: ${item.vibe},` : ''} Season: ${item.season}, Color: ${item.dominantColor}, ImageURL: ${item.imageUrl} }`
    ).join("\n")}
    `.trim();

    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: fullPrompt
                    }
                ]
            }
        ],
        config: {
            systemInstruction: SYSTEM_INSTRUCTIONS[CacheType.OUTFIT_GENERATION],
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    outfits: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                outfit_id: { type: Type.STRING },
                                outfit_pieces: {
                                    type: Type.OBJECT,
                                    properties: {
                                        Top: { type: Type.STRING },
                                        Bottom: { type: Type.STRING },
                                        Shoes: { type: Type.STRING }
                                    },
                                    required: ['Top', 'Bottom', 'Shoes']
                                },
                                match: { type: Type.NUMBER }
                            },
                            required: ['outfit_id', 'outfit_pieces', 'match']
                        }
                    }
                },
                required: ['outfits']
            },
        }
    });

    // console.log('promptTokenCount: ' + response.usageMetadata?.promptTokensDetails?.map(outfit=> {
    //     console.log(outfit.tokenCount);
    // }));
    // console.log('thoughtsTokenCount: ' + response.usageMetadata?.thoughtsTokenCount);
    // console.log('totalTokenCount: ' + response.usageMetadata?.totalTokenCount);

    const responseText = response.text;

    if (!responseText) {
        throw new Error('Gemini response is empty.');
    }

    return JSON.parse(responseText);
};