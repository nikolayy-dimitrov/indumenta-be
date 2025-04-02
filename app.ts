import dotenv from 'dotenv';
import express, { Application, json, Request, Response } from 'express';
import cors from 'cors';
import OpenAI from "openai";
import imageAnalysisRoutes from './src/routes/imageAnalysis.ts';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3001;
const frontendUrl = process.env.FRONTEND_URL;
const appUrl = process.env.APP_URL;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors({
    origin: frontendUrl || appUrl,
    credentials: true,
}));

app.use(json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/images', imageAnalysisRoutes);

// API Route to handle the OpenAI request
app.post('/api/generate-outfit', async (req: Request, res: Response) => {
    const { wardrobe, stylePreferences } = req.body;

    const prefilterPrompt = `
        You are an assistant that helps generate outfits in JSON format from wardrobe items based on user preferences and metadata.

        ### User Preferences:
        ${stylePreferences.color ? `- **Color Preference:** ${stylePreferences.color}` : ''}
        ${stylePreferences.occasion ? `- **Occasion:** ${stylePreferences.occasion}` : ''}

        ### Wardrobe Metadata:
        Each item in the wardrobe is represented as follows:

        - Category: The type of item ("Top" - Shirt, Jacket, T-shirt, etc.; "Bottom" - Pants, Skirt, etc.; "Shoes").
        - Subcategory: Additional information about the item (e.g. "Low-Top Sneakers", "Sneakers")
        - Vibe: The item's style or mood (e.g. "Casual", "Formal").
        - Season: The item's suitability for a season ("Winter", "Summer", etc.).
        - Color: The dominant color of the item.
        - ImageURL: A URL pointing to the item's image.

        ### Wardrobe Items:
        ${wardrobe.map((item: any) =>
        `- Item ${item.id}: { Category: ${item.category}, ${item.subCategory ? `Subcategory: ${item.subCategory},` : ''} ${item.vibe ? `Vibe: ${item.vibe},` : ''} Season: ${item.season}, Color: ${item.dominantColor}, ImageURL: ${item.imageUrl} }`
    ).join("\n")}

        ### Task:
        Select and recommend the top 3 outfits based on the user's preferences. Each outfit must contain:
        - 1 "Top"
        - 1 "Bottom"
        - 1 "Shoes"

        Outfits should be ranked based on their match percentage, considering both color preference and occasion.
        Output only the following JSON format:

        \`\`\`json
        {
            "outfits": [
                {
                    "outfit_id": "Outfit 1",
                    "outfit_pieces": {
                        "Top": "item.id",
                        "Bottom": "item.id",
                        "Shoes": "item.id"
                    },
                    "match": 100
                },
                {
                    "outfit_id": "Outfit 2",
                    "outfit_pieces": {
                        "Top": "item.id",
                        "Bottom": "item.id",
                        "Shoes": "item.id"
                    },
                    "match": 85
                },
                {
                    "outfit_id": "Outfit 3",
                    "outfit_pieces": {
                        "Top": "item.id",
                        "Bottom": "item.id",
                        "Shoes": "item.id"
                    },
                    "match": 70
                }
            ]
        }
        \`\`\`
    `;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful wardrobe assistant.' },
                { role: 'user', content: prefilterPrompt },
            ],
            max_tokens: 500,
            temperature: 0.7,
        });

        const responseText = response.choices[0]?.message?.content;

        if (!responseText) {
            return res.status(500).json({ error: 'OpenAI response is empty.' });
        }

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'Failed to extract JSON from OpenAI response.' });
        }

        const outfits = JSON.parse(jsonMatch[1]);
        res.json(outfits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate outfits.' });
    }
});

app.post('/api/rekognition-analyze', async (req: Request, res: Response) => {
    try {
        // Redirect to the imageAnalysis route handler
        res.redirect(307, '/api/images/analyze');
    } catch (error) {
        console.error('Error in rekognition redirect:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});