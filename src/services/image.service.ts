import { openai } from "../config/openai";

export interface ClothingAnalysisResult {
    category: string;
    subCategory?: string;
    season: string[];
    occasion: string[];
    color: string;
    secondaryColor?: string;
}

export const analyzeImage = async (signedUrl: string): Promise<ClothingAnalysisResult> => {
    const prompt = `
        Analyze this clothing image and classify it. Return only a valid JSON object with the following fields:

        category: general type (e.g., "Shirt", "Pants")
        subCategory (optional): specific type (e.g., "T-shirt", "Joggers")
        color: primary color in 6-digit hex code (e.g., "#000000")
        secondaryColor (optional): secondary color in hex (omit if not present)
        occasion: array of suitable occasions (e.g., ["Casual", "Formal"])
        season: array of best-fit seasons (e.g., ["Summer", "Fall"])

        Do not return any explanation, markdown, or text outside the JSON. Only include valid fields.
    `;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'You are a clothing image analyzer.' },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: signedUrl } }
                ]
            }
        ],
        max_tokens: 200,
        temperature: 0.4,
    });

    const responseText = response.choices[0]?.message?.content;
    if (!responseText) {
        throw new Error('OpenAI response is empty.');
    }

    try {
        return JSON.parse(responseText);
    } catch {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from OpenAI response.');
        }
        return JSON.parse(jsonMatch[1]);
    }
}