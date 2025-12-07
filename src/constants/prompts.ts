export enum CacheType {
    IMAGE_ANALYSIS = 'image_analysis',
    OUTFIT_GENERATION = 'outfit_generation'
}

export const PROMPT = {
    [CacheType.IMAGE_ANALYSIS] : `
        Analyze this clothing image and classify it. color/secondaryColor field should be in hexadecimal format.
    `.trim(),
    [CacheType.OUTFIT_GENERATION] : `
        You are an assistant that helps generate outfits in JSON format from wardrobe items based on user preferences and metadata.
        
        ### Wardrobe Item Metadata:
        Each item in the wardrobe is represented as follows:
        
        - **Category**: The type of item ("Top" - Shirt, Jacket, T-shirt, etc.; "Bottom" - Pants, Skirt, etc.; "Shoes")
        - **Subcategory**: Additional information about the item (e.g. "Low-Top Sneakers", "Sneakers")
        - **Vibe**: The item's style or mood (e.g. "Casual", "Formal")
        - **Season**: The item's suitability for a season ("Winter", "Summer", etc.)
        - **Color**: The dominant color of the item
        - **ImageURL**: A URL pointing to the item's image
        
        ### Task Instructions:
        Select and recommend the top 3 outfits based on the user's preferences. Each outfit must contain:
        - 1 "Top"
        - 1 "Bottom"
        - 1 "Shoes"
        
        Outfits should be ranked based on their match percentage, considering both color preference and occasion.
        
        ### Important:
        - Only use item IDs that are provided in the wardrobe items
        - Ensure outfits are season-appropriate when possible
        - Prioritize color coordination and style cohesion
        - Match percentage should reflect how well the outfit meets the user's preferences and should always be <= 100
        - "outfit_id" value should be displayed as "Outfit 1", "Outfit 2", etc. 
    `.trim()
};

export const SYSTEM_INSTRUCTIONS = {
    [CacheType.IMAGE_ANALYSIS] : 'You are a clothing image analyzer.',
    [CacheType.OUTFIT_GENERATION] : 'You are an expert fashion stylist and outfit coordinator.'
};