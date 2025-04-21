import { openai } from '../config/openai';

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

export const generateOutfitSuggestions = async (wardrobe: WardrobeItem[], stylePreferences: StylePreferences) => {
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
        ${wardrobe.map((item) =>
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

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a helpful wardrobe assistant.' },
            { role: 'user', content: prefilterPrompt },
        ],
        max_tokens: 550,
        temperature: 0.5,
    });

    const responseText = response.choices[0]?.message?.content;
    if (!responseText) {
        throw new Error('OpenAI response is empty.');
    }

    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
        throw new Error('Failed to extract JSON from OpenAI response.');
    }

    return JSON.parse(jsonMatch[1]);
};