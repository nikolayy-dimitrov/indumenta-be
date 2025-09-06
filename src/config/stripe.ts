import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from './env';

if (!STRIPE_SECRET_KEY) {
    throw new Error('Missing Stripe API key');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);