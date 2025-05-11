import { DetectLabelsCommand, Label } from '@aws-sdk/client-rekognition';
import { rekognitionClient } from '../config/rekognition';

// Define proper interfaces for return types
export interface ClothingAnalysisResult {
    category: string;
    subCategory: string | null;
    vibe: string;
    season: string;
    color: string;
    allLabels: string[];
    confidence: {
        category: number;
        subCategory: number | null;
        vibe: number;
        season: number;
        color: number;
    };
}

// New interface for mapping labels with confidence
interface LabelWithConfidence {
    name: string;
    confidence: number;
}

// Enhanced category mapping
interface CategoryMapping {
    category: string;
    keywords: string[];
}

// Define detailed category mappings
const CATEGORY_MAPPINGS: CategoryMapping[] = [
    {
        category: 'Top',
        keywords: ['shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'jacket', 'coat', 'polo', 'cardigan', 'sweatshirt', 'blazer', 'vest', 'tank top']
    },
    {
        category: 'Bottom',
        keywords: ['pants', 'jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'sweatpants', 'joggers']
    },
    {
        category: 'Shoes',
        keywords: ['shoes', 'footwear', 'sneakers', 'boots', 'heels', 'flats', 'sandals', 'loafers', 'oxford', 'slippers']
    },
    {
        category: 'Dress',
        keywords: ['dress', 'gown', 'robe', 'frock']
    },
    {
        category: 'Accessories',
        keywords: ['hat', 'cap', 'beanie', 'scarf', 'gloves', 'tie', 'belt', 'purse', 'bag', 'backpack', 'wallet', 'watch', 'jewelry', 'necklace', 'bracelet', 'earrings', 'sunglasses']
    },
    {
        category: 'Outerwear',
        keywords: ['coat', 'jacket', 'parka', 'windbreaker', 'raincoat', 'overcoat', 'poncho']
    }
];

// Define subcategories with more specificity
const SUBCATEGORY_MAPPINGS: { [category: string]: CategoryMapping[] } = {
    'Top': [
        { category: 'T-Shirt', keywords: ['t-shirt', 't shirt', 'tee'] },
        { category: 'Dress Shirt', keywords: ['dress shirt', 'button-up', 'button up', 'formal shirt'] },
        { category: 'Blouse', keywords: ['blouse'] },
        { category: 'Sweater', keywords: ['sweater', 'pullover', 'jumper'] },
        { category: 'Hoodie', keywords: ['hoodie', 'hooded'] },
        { category: 'Sweatshirt', keywords: ['sweatshirt'] },
        { category: 'Tank Top', keywords: ['tank top', 'sleeveless', 'camisole'] },
        { category: 'Polo', keywords: ['polo'] },
    ],
    'Bottom': [
        { category: 'Jeans', keywords: ['jeans', 'denim pants'] },
        { category: 'Chinos', keywords: ['chinos', 'khakis'] },
        { category: 'Shorts', keywords: ['shorts'] },
        { category: 'Skirt', keywords: ['skirt'] },
        { category: 'Leggings', keywords: ['leggings', 'tights'] },
        { category: 'Sweatpants', keywords: ['sweatpants', 'joggers', 'track pants'] },
    ],
    'Shoes': [
        { category: 'Sneakers', keywords: ['sneakers', 'trainers', 'athletic shoes'] },
        { category: 'Boots', keywords: ['boots', 'ankle boots', 'combat boots'] },
        { category: 'Heels', keywords: ['heels', 'high heels', 'pumps'] },
        { category: 'Flats', keywords: ['flats', 'ballet flats'] },
        { category: 'Sandals', keywords: ['sandals', 'flip flops'] },
        { category: 'Loafers', keywords: ['loafers', 'slip-ons'] },
    ],
    'Dress': [
        { category: 'Casual Dress', keywords: ['casual dress', 'sundress', 'day dress'] },
        { category: 'Formal Dress', keywords: ['formal dress', 'evening dress', 'gown'] },
        { category: 'Cocktail Dress', keywords: ['cocktail dress', 'party dress'] },
    ],
    'Outerwear': [
        { category: 'Winter Coat', keywords: ['winter coat', 'parka', 'down jacket'] },
        { category: 'Light Jacket', keywords: ['light jacket', 'bomber', 'denim jacket'] },
        { category: 'Blazer', keywords: ['blazer', 'sports coat'] },
        { category: 'Windbreaker', keywords: ['windbreaker', 'rain jacket'] },
    ],
    'Accessories': [
        { category: 'Hat', keywords: ['hat', 'cap', 'beanie'] },
        { category: 'Scarf', keywords: ['scarf', 'shawl'] },
        { category: 'Bag', keywords: ['bag', 'purse', 'handbag', 'backpack'] },
        { category: 'Jewelry', keywords: ['jewelry', 'necklace', 'bracelet', 'earrings'] },
        { category: 'Belt', keywords: ['belt'] },
        { category: 'Sunglasses', keywords: ['sunglasses', 'eyewear'] },
    ]
};

// Enhanced vibe/occasion mapping with keywords
interface VibeMapping {
    vibe: string;
    keywords: string[];
}

const VIBE_MAPPINGS: VibeMapping[] = [
    {
        vibe: 'Formal',
        keywords: ['formal', 'suit', 'tuxedo', 'dress', 'elegant', 'professional', 'business', 'tie', 'blazer', 'ceremony']
    },
    {
        vibe: 'Business Casual',
        keywords: ['business casual', 'office', 'professional', 'work', 'khaki', 'chino', 'blazer']
    },
    {
        vibe: 'Casual',
        keywords: ['casual', 'everyday', 'relaxed', 'comfortable', 't-shirt', 'jeans', 'sneakers']
    },
    {
        vibe: 'Sporty',
        keywords: ['sports', 'athletic', 'gym', 'workout', 'exercise', 'running', 'training', 'fitness']
    },
    {
        vibe: 'Streetwear',
        keywords: ['streetwear', 'urban', 'hip-hop', 'trendy', 'skateboard']
    },
    {
        vibe: 'Bohemian',
        keywords: ['bohemian', 'boho', 'hippie', 'ethnic', 'pattern', 'flowy']
    },
    {
        vibe: 'Vintage',
        keywords: ['vintage', 'retro', 'classic', 'old-fashioned']
    }
];

// Expanded seasons with better keyword matching
interface SeasonMapping {
    season: string;
    keywords: string[];
}

const SEASON_MAPPINGS: SeasonMapping[] = [
    {
        season: 'Winter',
        keywords: ['winter', 'cold', 'snow', 'heavy', 'coat', 'warm', 'sweater', 'wool', 'knit', 'fleece', 'parka', 'thermal']
    },
    {
        season: 'Summer',
        keywords: ['summer', 'hot', 'beach', 'light', 'thin', 'shorts', 'sandals', 'tank', 'sleeveless', 'linen', 'cotton']
    },
    {
        season: 'Spring',
        keywords: ['spring', 'light jacket', 'rain', 'windbreaker', 'mild', 'floral', 'pastel', 'waterproof']
    },
    {
        season: 'Fall',
        keywords: ['fall', 'autumn', 'jacket', 'light coat', 'layering', 'corduroy', 'flannel', 'boots']
    }
];

// Significantly expanded color detection
interface ColorMapping {
    color: string;
    keywords: string[];
}

const COLOR_MAPPINGS: ColorMapping[] = [
    {
        color: 'Red',
        keywords: ['red', 'crimson', 'scarlet', 'maroon', 'burgundy', 'ruby', 'cherry']
    },
    {
        color: 'Blue',
        keywords: ['blue', 'navy', 'azure', 'cobalt', 'indigo', 'teal', 'turquoise', 'aqua', 'cyan']
    },
    {
        color: 'Green',
        keywords: ['green', 'olive', 'emerald', 'lime', 'sage', 'forest', 'mint', 'jade']
    },
    {
        color: 'Yellow',
        keywords: ['yellow', 'gold', 'amber', 'mustard', 'lemon', 'honey']
    },
    {
        color: 'Orange',
        keywords: ['orange', 'tangerine', 'peach', 'coral', 'apricot', 'rust']
    },
    {
        color: 'Purple',
        keywords: ['purple', 'violet', 'lavender', 'plum', 'magenta', 'lilac', 'mauve']
    },
    {
        color: 'Pink',
        keywords: ['pink', 'rose', 'fuchsia', 'blush', 'salmon']
    },
    {
        color: 'Brown',
        keywords: ['brown', 'tan', 'beige', 'khaki', 'caramel', 'chocolate', 'coffee', 'mocha', 'chestnut']
    },
    {
        color: 'Black',
        keywords: ['black', 'onyx', 'charcoal', 'ebony', 'jet']
    },
    {
        color: 'White',
        keywords: ['white', 'ivory', 'cream', 'eggshell', 'pearl', 'snow', 'off-white']
    },
    {
        color: 'Gray',
        keywords: ['gray', 'grey', 'silver', 'slate', 'ash', 'steel', 'pewter']
    }
];

// Helper function to find best match with confidence
function findBestMatch(
    labels: LabelWithConfidence[],
    mappings: CategoryMapping[] | VibeMapping[] | SeasonMapping[] | ColorMapping[]
): { match: string; confidence: number } {
    let bestMatch = '';
    let highestConfidence = 0;

    for (const mapping of mappings) {
        for (const label of labels) {
            const labelName = label.name.toLowerCase();
            for (const keyword of mapping.keywords) {
                if (labelName.includes(keyword.toLowerCase())) {
                    if (label.confidence > highestConfidence) {
                        bestMatch = 'category' in mapping ? mapping.category :
                            'vibe' in mapping ? mapping.vibe :
                                'season' in mapping ? mapping.season :
                                    'color' in mapping ? mapping.color : '';
                        highestConfidence = label.confidence;
                    }
                }
            }
        }
    }

    return {
        match: bestMatch || 'Unknown',
        confidence: highestConfidence
    };
}

// Improved subcategory detection that considers the parent category
function findSubCategory(labels: LabelWithConfidence[], category: string): { subCategory: string | null; confidence: number | null } {
    if (!category || category === 'Unknown' || !(category in SUBCATEGORY_MAPPINGS)) {
        return { subCategory: null, confidence: null };
    }

    const { match, confidence } = findBestMatch(labels, SUBCATEGORY_MAPPINGS[category]);
    return {
        subCategory: match !== 'Unknown' ? match : null,
        confidence: match !== 'Unknown' ? confidence : null
    };
}

// Extract text descriptions from objects for context-aware matching
function extractTextualContext(labels: Label[]): string[] {
    const textualContexts: string[] = [];

    // Extract parents for more context
    labels.forEach(label => {
        if (label.Parents && label.Parents.length > 0) {
            label.Parents.forEach(parent => {
                if (parent.Name) textualContexts.push(parent.Name);
            });
        }
    });

    // Extract instances for more detailed analysis
    labels.forEach(label => {
        if (label.Instances && label.Instances.length > 0) {
            textualContexts.push(`Multiple ${label.Name}`);
        }
    });

    return textualContexts;
}

// Main function to analyze image using AWS Rekognition
export const analyzeImage = async (imageBytes: Buffer): Promise<ClothingAnalysisResult> => {
    const detectLabelsCommand = new DetectLabelsCommand({
        Image: { Bytes: imageBytes },
        MaxLabels: 50, // Increased for better detection
        MinConfidence: 60 // Slightly lower to catch more potential matches
    });

    const labelResponse = await rekognitionClient.send(detectLabelsCommand);

    // Transform AWS response to our format
    const labelsWithConfidence: LabelWithConfidence[] = labelResponse.Labels?.map(label => ({
        name: label.Name || '',
        confidence: label.Confidence || 0
    })) || [];

    // Extract additional textual context for better understanding
    const textualContext = extractTextualContext(labelResponse.Labels || []);

    // Add textual context as additional "labels" with lower confidence
    textualContext.forEach(context => {
        labelsWithConfidence.push({
            name: context,
            confidence: 70 // Lower confidence for derived context
        });
    });

    // Get all label names for return value
    const allLabels = labelsWithConfidence.map(label => label.name);

    // Find best matches using our enhanced mappings
    const categoryResult = findBestMatch(labelsWithConfidence, CATEGORY_MAPPINGS);
    const subCategoryResult = findSubCategory(labelsWithConfidence, categoryResult.match);
    const vibeResult = findBestMatch(labelsWithConfidence, VIBE_MAPPINGS);
    const seasonResult = findBestMatch(labelsWithConfidence, SEASON_MAPPINGS);
    const colorResult = findBestMatch(labelsWithConfidence, COLOR_MAPPINGS);

    return {
        category: categoryResult.match,
        subCategory: subCategoryResult.subCategory,
        vibe: vibeResult.match,
        season: seasonResult.match,
        color: colorResult.match,
        allLabels,
        confidence: {
            category: Math.round(categoryResult.confidence),
            subCategory: subCategoryResult.confidence !== null ? Math.round(subCategoryResult.confidence) : null,
            vibe: Math.round(vibeResult.confidence),
            season: Math.round(seasonResult.confidence),
            color: Math.round(colorResult.confidence)
        }
    };
};