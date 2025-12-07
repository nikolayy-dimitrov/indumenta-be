import { GoogleGenAI } from "@google/genai";

import { GEMINI_API_KEY } from './env';

if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI API key');
}

export const genAI = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
});