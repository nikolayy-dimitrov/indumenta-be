import dotenv from 'dotenv';
import express, { Application, json, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import OpenAI from "openai";

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

// Image labeling

// Configure multer for file upload (in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Configure AWS Rekognition client
const rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

// Map AWS labels to your clothing categories
const mapToClothingCategory = (labels: string[]): string => {
    const labelMap: { [key: string]: string } = {
        'shirt': 'Top',
        't-shirt': 'Top',
        'top': 'Top',
        'blouse': 'Top',
        'sweater': 'Top',
        'hoodie': 'Top',
        'jacket': 'Top',
        'coat': 'Top',
        'pants': 'Bottom',
        'jeans': 'Bottom',
        'trousers': 'Bottom',
        'shorts': 'Bottom',
        'skirt': 'Bottom',
        'shoes': 'Shoes',
        'footwear': 'Shoes',
        'sneakers': 'Shoes',
        'boots': 'Shoes',
        'dress': 'Dress',
        'suit': 'Top',
    };

    const labelSet = new Set(labels.map(l => l.toLowerCase()));
    for (const [keyword, category] of Object.entries(labelMap)) {
        if (labelSet.has(keyword)) {
            return category;
        }
    }
    return 'Unknown';
};

// Map AWS labels to occasions
const determineOccasion = (labels: string[]): string => {
    const labelSet = new Set(labels.map(l => l.toLowerCase()));
    if (labelSet.has('formal') || labelSet.has('suit') || labelSet.has('dress')) {
        return 'Formal';
    } else if (labelSet.has('sports') || labelSet.has('athletic') || labelSet.has('gym')) {
        return 'Sports';
    } else if (labelSet.has('casual')) {
        return 'Casual';
    }
    return 'Casual'; // Default to casual
};

// Determine the dominant color with improved color detection
const determineColor = (labels: string[]): string => {
    const colors = [
        'red', 'blue', 'green', 'yellow', 'black',
        'white', 'purple', 'orange', 'pink', 'brown',
        'gray', 'grey', 'beige', 'navy', 'teal',
        'maroon', 'olive', 'gold', 'silver', 'tan'
    ];

    for (const label of labels) {
        const labelLower = label.toLowerCase();
        for (const color of colors) {
            if (labelLower.includes(color)) {
                return color.charAt(0).toUpperCase() + color.slice(1);
            }
        }
    }
    return 'Unknown';
};

// Image analysis endpoint
app.post('/api/images/analyze', upload.single('image'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Prepare image data for AWS Rekognition
        const imageBytes = req.file.buffer;

        // Call AWS Rekognition to detect labels
        const detectLabelsCommand = new DetectLabelsCommand({
            Image: { Bytes: imageBytes },
            MaxLabels: 20,
            MinConfidence: 70
        });

        const labelResponse = await rekognitionClient.send(detectLabelsCommand);
        const labels = labelResponse.Labels?.map(label => label.Name || '') || [];

        // Process the labels to determine clothing type, occasion, and color
        const category = mapToClothingCategory(labels);
        const occasion = determineOccasion(labels);
        const color = determineColor(labels);

        // Determine season from labels
        const seasonKeywords: { [key: string]: string[] } = {
            'winter': ['winter', 'coat', 'warm', 'sweater', 'wool'],
            'summer': ['summer', 'light', 'thin', 'shorts', 'beach'],
            'spring': ['spring', 'light jacket', 'rain', 'windbreaker'],
            'fall': ['fall', 'autumn', 'jacket', 'light coat']
        };

        let season = 'All Season';
        for (const [s, keywords] of Object.entries(seasonKeywords)) {
            for (const keyword of keywords) {
                if (labels.some(label => label.toLowerCase().includes(keyword))) {
                    season = s.charAt(0).toUpperCase() + s.slice(1);
                    break;
                }
            }
            if (season !== 'All Season') break;
        }

        res.json({
            success: true,
            category,
            subCategory: labels.find(label =>
                label.toLowerCase().includes('shirt') ||
                label.toLowerCase().includes('pants') ||
                label.toLowerCase().includes('shoes')
            ) || null,
            vibe: occasion,
            season,
            color,
            allLabels: labels,
        });
    } catch (error) {
        console.error('Error analyzing image:', error);
        res.status(500).json({
            error: 'Error analyzing image',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// OpenAI outfit suggestions request

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

// Additional endpoint for rekognition
app.post('/api/rekognition-analyze', async (req: Request, res: Response) => {
    try {
        res.redirect(307, '/api/images/analyze');
    } catch (error) {
        console.error('Error in rekognition redirect:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});
