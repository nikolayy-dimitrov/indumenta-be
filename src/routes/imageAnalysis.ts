import express from 'express';
import {
    RekognitionClient,
    DetectLabelsCommand
} from '@aws-sdk/client-rekognition';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
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

// Determine the predominant color with improved color detection
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

// Enhanced file upload and analysis endpoint
router.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Prepare image data for AWS Rekognition
        const imageBytes = req.file.buffer;

        // Call AWS Rekognition to detect labels
        const detectLabelsCommand = new DetectLabelsCommand({
            Image: {
                Bytes: imageBytes
            },
            MaxLabels: 20,
            MinConfidence: 70
        });

        const labelResponse = await rekognitionClient.send(detectLabelsCommand);

        // Extract label names
        const labels = labelResponse.Labels?.map(label => label.Name || '') || [];

        // Process the labels to determine clothing type, occasion, and color
        const category = mapToClothingCategory(labels);
        const occasion = determineOccasion(labels);
        const color = determineColor(labels);

        // Get season from labels
        const seasonKeywords = {
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

export default router;