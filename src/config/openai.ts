import OpenAI from "openai";
import { OPENAI_API_KEY } from './env';

if (!OPENAI_API_KEY) {
    throw new Error('Missing OpenAI API key');
}

export const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});