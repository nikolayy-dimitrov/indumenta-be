import { stripe } from '../config/stripe';

class PaymentService {
    async createPaymentIntent(amount: number, currency: string = 'usd') {
        try {
            return await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency,
                automatic_payment_methods: { enabled: true },
            });
        } catch (error) {
            throw new Error(`Payment intent creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export default new PaymentService();