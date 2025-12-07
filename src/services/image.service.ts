import { Type } from "@google/genai";

import { genAI } from "../config/gemini";
import { CacheType, PROMPT, SYSTEM_INSTRUCTIONS } from "../constants/prompts";

export interface ClothingAnalysisResult {
    category: string;
    subCategory?: string;
    season: string[];
    occasion: string[];
    color: string;
    secondaryColor?: string;
}

export const analyzeImage = async (signedUrl: string): Promise<ClothingAnalysisResult> => {
    try {
        const imageResponse = await fetch(signedUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        const mimeType = imageResponse.headers.get('content-type') || 'image/png';

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                data: imageBase64,
                                mimeType: mimeType
                            }
                        },
                        {
                            text: PROMPT[CacheType.IMAGE_ANALYSIS]
                        }
                    ]
                }
            ],
            config: {
                systemInstruction: SYSTEM_INSTRUCTIONS[CacheType.IMAGE_ANALYSIS],
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING },
                        subCategory: { type: Type.STRING },
                        season: { type: Type.ARRAY, items: { type: Type.STRING } },
                        occasion: { type: Type.ARRAY, items: { type: Type.STRING } },
                        color: { type: Type.STRING },
                        secondaryColor: { type: Type.STRING },
                    },
                    required: [ "category", "season", "occasion", "color" ]
                }
            }
        });

        // console.log('totalTokenCount: ' + response.usageMetadata?.totalTokenCount);

        const responseText = response.text;
        if (!responseText) {
            throw new Error('Gemini response is empty.');
        }

        return JSON.parse(responseText);
    } catch (error: any) {
        console.error('Gemini API error:', error);

        if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            throw new Error('Gemini API quota exceeded. Please try again later.');
        }

        if (error.message?.includes('SAFETY') || error.message?.includes('blocked')) {
            throw new Error('Image was blocked by Gemini safety filters.');
        }

        if (error.message?.includes('INVALID_ARGUMENT')) {
            throw new Error('Invalid image format or data.');
        }

        if (error.message?.includes('API key not valid')) {
            throw new Error('Invalid Gemini API key.');
        }

        throw new Error(`Image analysis failed: ${error.message}`);
    }
}