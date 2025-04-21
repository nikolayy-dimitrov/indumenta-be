import { Request, Response } from 'express';
import { generateOutfitSuggestions } from '../services/openai.service';

export const generateOutfitController = async (req: Request, res: Response) => {
    try {
        const { wardrobe, stylePreferences } = req.body;

        // Validate input
        if (!wardrobe || !Array.isArray(wardrobe) || wardrobe.length === 0) {
            return res.status(400).json({ error: 'Valid wardrobe items are required' });
        }

        // Call the OpenAI service to generate outfit suggestions
        const outfits = await generateOutfitSuggestions(wardrobe, stylePreferences || {});

        res.json(outfits);
    } catch (error) {
        console.error('Failed to generate outfits:', error);
        res.status(500).json({
            error: 'Failed to generate outfits.',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};