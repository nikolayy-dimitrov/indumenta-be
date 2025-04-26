import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../config/firebase';
import { stripe } from '../config/stripe';
import { SubscriptionTier } from '../services/subscription.service';

export const webhookController = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error('Invalid signature', err);
        return res.status(400).send('Webhook Error');
    }

    if (
        [
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted'
        ].includes(event.type)
    ) {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const latestInvoiceId = sub.latest_invoice as string;
        const invoice = await stripe.invoices.retrieve(latestInvoiceId);

        // Determine subscription tier based on price ID
        let subscriptionTier: SubscriptionTier | null = null;
        const priceId = sub.items.data[0]?.price.id;

        // Map price IDs to subscription tiers
        if (process.env.STRIPE_PRICE_ID_PREMIUM === 'price_premium_monthly') {
            subscriptionTier = SubscriptionTier.PREMIUM;
        } else if (process.env.STRIPE_PRICE_ID_BASIC === 'price_basic_monthly') {
            subscriptionTier = SubscriptionTier.BASIC;
        }

        // Build update payload
        const updateData: Record<string, any> = {
            subscriptionStatus: sub.status,
            subscriptionId: sub.id,
            priceId: priceId ?? null,
        };

        // Set subscription tier if available
        if (subscriptionTier) {
            updateData.subscriptionTier = subscriptionTier;
        }

        // If subscription is canceled or has expired, downgrade to FREE tier
        if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
            updateData.subscriptionTier = SubscriptionTier.FREE;
            console.log(`Downgrading user with customer ID ${customerId} to FREE tier due to ${sub.status} status`);
        }

        if (invoice.period_start != null)
            updateData.currentPeriodStart = invoice.period_start;
        if (invoice.period_end != null)
            updateData.currentPeriodEnd = invoice.period_end;
        if (sub.cancel_at_period_end != null)
            updateData.cancelAtPeriodEnd = sub.cancel_at_period_end;
        if (sub.canceled_at != null)
            updateData.canceledAt = sub.canceled_at;

        // Update Firestore
        const usersRef = db.collection('users');
        const snapshot = await usersRef
            .where('stripeCustomerId', '==', customerId)
            .get();

        if (!snapshot.empty) {
            await Promise.all(
                snapshot.docs.map(doc => doc.ref.update(updateData))
            );
            console.log(`Updated subscription for ${customerId}`);
        } else {
            console.warn(`No user for Stripe customer ${customerId}`);
        }
    } else {
        console.log(`Ignoring event type ${event.type}`);
    }

    res.json({ received: true });
};