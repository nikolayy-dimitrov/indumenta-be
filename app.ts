import dotenv from 'dotenv';

import express, { Application, json, Request, Response } from 'express';
import cors from 'cors';

import OpenAI from "openai";

import { Dragoneye } from "dragoneye-node";
import { ClassificationPredictImageResponse } from "dragoneye-node/dist/classification";

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3001;

const token = process.env.DRAGONEYE_API_KEY;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(json());
app.use(express.urlencoded({ extended: false }));

// API route to handle the Dragoneye request
app.post('/api/predict', async (req: Request, res: Response) => {
    const { fileUrl, modelName } = req.body;
    const dragoneyeClient = new Dragoneye({
        apiKey: token,
    });

    try {
        // Call the Dragoneye API and type the response
        const response: ClassificationPredictImageResponse = await dragoneyeClient.classification.predict({
            image: {
                url: fileUrl,
            },
            modelName,
        });

        if (!response.predictions || response.predictions.length === 0) {
            // If no predictions, set default values
            return res.json([{
                category: "Shoes",
                vibe: null,
                season: "Seasonless",
                color: null
            }]);
        }

        const predictions = response.predictions.map(prediction => {
            // Category display name
            const categoryName = prediction.category?.displayName || null;

            // Find the "vibe" trait
            const vibeTrait = prediction.traits.find(trait => trait.name === 'vibe');
            const vibeName = vibeTrait?.taxons[0]?.displayName || null;

            const seasonTrait = prediction.traits.find(trait => trait.name === 'season');
            const seasonName = seasonTrait?.taxons[0].displayName || null

            const colorTrait = prediction.traits.find(trait => trait.name === 'color_main');
            const mainColorName = colorTrait?.taxons[0].name || null;

            console.log(prediction);
            return { category: categoryName, vibe: vibeName, season: seasonName, color: mainColorName };
        });

        res.json(predictions);
    } catch (err) {
        res.status(500);
    }
});

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
        - Vibe: The item's style or mood (e.g., "Casual", "Formal").
        - Season: The item's suitability for a season ("Winter", "Summer", etc.).
        - Color: The dominant color of the item.
        - ImageURL: A URL pointing to the item's image.

        ### Wardrobe Items:
        ${wardrobe.map((item: any) =>
        `- Item ${item.id}: { Category: ${item.category}, ${item.vibe ? `Vibe: ${item.vibe},` : ''} Season: ${item.season}, Color: ${item.dominantColor}, ImageURL: ${item.imageUrl} }`
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

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})
