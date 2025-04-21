import { DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { rekognitionClient } from '../config/rekognition';

// Map AWS labels to your clothing categories
export const mapToClothingCategory = (labels: string[]): string => {
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
export const determineOccasion = (labels: string[]): string => {
    const labelSet = new Set(labels.map(l => l.toLowerCase()));
    if (labelSet.has('formal') || labelSet.has('suit') || labelSet.has('dress')) {
        return 'Formal';
    } else if (labelSet.has('sports') || labelSet.has('athletic') || labelSet.has('gym')) {
        return 'Sports';
    } else if (labelSet.has('casual')) {
        return 'Casual';
    }
    return 'Unknown'; // Default to casual
};

// Determine the dominant color with improved color detection
export const determineColor = (labels: string[]): string => {
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

// Determine season from labels
export const determineSeason = (labels: string[]): string => {
    const seasonKeywords: { [key: string]: string[] } = {
        'winter': ['winter', 'coat', 'warm', 'sweater', 'wool'],
        'summer': ['summer', 'light', 'thin', 'shorts', 'beach'],
        'spring': ['spring', 'light jacket', 'rain', 'windbreaker'],
        'fall': ['fall', 'autumn', 'jacket', 'light coat']
    };

    let season = 'Seasonless';
    for (const [s, keywords] of Object.entries(seasonKeywords)) {
        for (const keyword of keywords) {
            if (labels.some(label => label.toLowerCase().includes(keyword))) {
                season = s.charAt(0).toUpperCase() + s.slice(1);
                break;
            }
        }
        if (season !== 'Seasonless') break;
    }

    return season;
};

// Analyze image using AWS Rekognition
export const analyzeImage = async (imageBytes: Buffer) => {
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
    const season = determineSeason(labels);

    const subCategory = labels.find(label =>
        label.toLowerCase().includes('shirt') ||
        label.toLowerCase().includes('pants') ||
        label.toLowerCase().includes('shoes')
    ) || null;

    return {
        category,
        subCategory,
        vibe: occasion,
        season,
        color,
        allLabels: labels,
    };
};