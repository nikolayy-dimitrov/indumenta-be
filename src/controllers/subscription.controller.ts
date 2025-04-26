import { Request, Response } from 'express';
import { stripe } from '../config/stripe';
import { db } from "../config/firebase";
import Stripe from "stripe";
import { getSubscriptionLimits, SubscriptionTier } from "../services/subscription.service";
import { getCurrentWeekStartTimestamp, getUserUsageCounter } from "../services/usage.service";
import { checkExpiredSubscriptions } from "../services/subscriptionChecker.service";

export const pricesConfig = async (req: Request, res: Response) => {
    const prices = await stripe.prices.list({
        lookup_keys: ['monthly_basic', 'monthly_premium'],
        expand: ['data.product']
    });

    res.send({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        prices: prices.data,
    });
}

export const createCustomer = async (req: Request, res: Response) => {
    const { userId, email } = req.body;
    console.log('💡 createCustomer called with:', { userId, email });

    if (!userId || !email) {
        console.warn('⚠️ Missing userId or email');
        return res.status(400).json({ error: 'Missing userId or email' });
    }

    const userRef = db.collection('users').doc(userId);

    try {
        // 1) Read existing Firestore document
        const userSnap = await userRef.get();
        const existingId = userSnap.data()?.stripeCustomerId as string | undefined;
        if (existingId) {
            console.log(`🔄 Existing stripeCustomerId found for ${userId}:`, existingId);
            return res.json({ customerId: existingId });
        }

        // 2) Create new Stripe customer
        console.log(`➕ Creating new Stripe customer for ${email}`);
        const customer = await stripe.customers.create({
            email,
            metadata: { firebaseUID: userId },
        });
        console.log(`🆔 Created Stripe customer ID:`, customer.id);

        // 3) Persist to Firestore
        try {
            await userRef.set({
                stripeCustomerId: customer.id,
                subscriptionTier: 'free'
            }, { merge: true });
            console.log(`✅ Stored stripeCustomerId in users/${userId}`);
        } catch (err) {
            console.error(`❌ Firestore write failed for users/${userId}:`, err);
            return res.status(500).json({ error: 'Failed to save customer ID' });
        }

        // 4) Respond to client
        return res.json({ customerId: customer.id });

    } catch (err: any) {
        console.error('❌ Error in createCustomer handler:', err);
        return res.status(500).json({ error: err.message || 'Internal error' });
    }
};

// Create subscription
export const createSubscription = async (req: Request, res: Response) => {
    try {
        // Extract the plan/price ID, uid, and email from the request body.
        const { priceId, userId, customerEmail, customerId } = req.body;

        if (!priceId || !userId || !customerEmail) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // Retrieve product price details from Stripe by priceId
        const price = await stripe.prices.retrieve(priceId);

        // Set subscription tier based on priceId
        const subscriptionTier =
            priceId === process.env.STRIPE_PRICE_ID_BASIC ? 'basic' :
                priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' :
                    'free';

        // Load Firestore doc by UID
        const userRef  = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        let stripeCustomerId = userSnap.exists
            ? userSnap.data()?.stripeCustomerId
            : undefined;

        // Retrieve stripe customer
        let customer;
        if (stripeCustomerId) {
            customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
        } else {
            customer = await stripe.customers.create({
                email: customerEmail,
                metadata: { uid: userId },
            });
            // Save ID and email in Firestore
            await userRef.set(
                { stripeCustomerId: customer.id, email: customer.email },
                { merge: true }
            );
        }

        // Create the subscription.
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ["latest_invoice.confirmation_secret"],
        });


        const invoice = subscription.latest_invoice as Stripe.Invoice & {
            confirmation_secret: { client_secret: string }
        };

        await db.doc(`users/${userId}`).set({
            stripeCustomerId: customerId,
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            subscriptionTier: subscriptionTier,
            priceId: subscription.items.data[0].price.id,
            currentPeriodStart: invoice.period_start,
            currentPeriodEnd: invoice.period_end,
            trialStart: subscription.trial_start,
            trialEnd: subscription.trial_end,
            planAmount: price.unit_amount,
            planCurrency: price.currency,
            planInterval: price.recurring?.interval
        }, { merge: true });

        // Return the subscription ID and the client secret from the PaymentIntent.
        res.send({
            subscriptionId: subscription.id,
            clientSecret: invoice.confirmation_secret.client_secret,
        });
    } catch (error: any) {
        console.error("Error creating subscription:", error);
        res.status(500).json({
            error: error.message || "Internal server error.",
        });
    }
};

// Fetch subscription status from firebase collection
export const getSubscriptionStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId;

        // Verify user is requesting their own data
        if (userId !== req.user!.uid) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();

        // Return subscription data if exists
        return res.json({
            subscription: userData?.subscription || null
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return res.status(500).json({
            error: 'Failed to fetch subscription data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Cancel subscription
export const cancelSubscription = async (req: Request, res: Response) => {
    try {
        const { subscriptionId, userId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'Subscription ID is required' });
        }

        // Verify user owns this subscription
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        if (!userData?.subscriptionId || userData.subscriptionId !== subscriptionId) {
            return res.status(403).json({ error: 'Unauthorized access to this subscription' });
        }

        // Cancel at period end
        await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
        });

        // Update user record
        await db.collection('users').doc(userId).update({
            'cancelAtPeriodEnd': true
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('Error canceling subscription:', error);
        return res.status(500).json({
            error: 'Failed to cancel subscription',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Reactivate cancelled subscription
export const reactivateSubscription = async (req: Request, res: Response) => {
    try {
        const { subscriptionId, userId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'Subscription ID is required' });
        }

        // Verify user owns this subscription
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        if (!userData?.subscriptionId || userData.subscriptionId !== subscriptionId) {
            return res.status(403).json({ error: 'Unauthorized access to this subscription' });
        }

        // Remove the cancellation
        await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false
        });

        // Update user record
        await db.collection('users').doc(userId).update({
            'cancelAtPeriodEnd': false
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('Error reactivating subscription:', error);
        return res.status(500).json({
            error: 'Failed to reactivate subscription',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Update payment method
export const createSetupIntent = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.uid;

        // Get user data to find Stripe customer ID
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        const customerId = userData?.stripeCustomerId;

        if (!customerId) {
            return res.status(400).json({ error: 'No Stripe customer found for this user' });
        }

        // Create setup intent for updating payment method
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
        });

        return res.json({
            clientSecret: setupIntent.client_secret
        });
    } catch (error) {
        console.error('Error creating setup intent:', error);
        return res.status(500).json({
            error: 'Failed to create setup intent',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Verify payment status
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { payment_intent } = req.query;

        if (!payment_intent || typeof payment_intent !== 'string') {
            return res.status(400).json({ error: 'Payment intent ID is required' });
        }

        // Retrieve the payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);

        // Get customer details if needed
        let customerEmail = '';
        if (paymentIntent.customer) {
            const customer = await stripe.customers.retrieve(paymentIntent.customer as string);
            if (!('deleted' in customer)) {
                customerEmail = customer.email || '';
            }
        }

        return res.json({
            status: paymentIntent.status,
            customer_email: customerEmail,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            error: 'Failed to verify payment',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const createSession = async (req: Request, res: Response) => {
    const session = await stripe.checkout.sessions.create({
        ui_mode: "custom",
        customer_email: req.body.customerEmail,
        line_items: [{
            price: req.body.priceId,
            quantity: 1
        }],
        mode: "subscription",
        return_url: `${process.env.FRONTEND_URL}/return?session_id={CHECKOUT_SESSION_ID}`,
        automatic_tax: { enabled: true },
    });
    res.send({ clientSecret: session.client_secret });
};

export const sessionStatus = async (req: Request, res: Response) => {
    const session = await stripe.checkout.sessions.retrieve(<string>req.query.session_id);
    res.send({
        status: session.status,
        customer_email: session.customer_details?.email
    });
};

// Fetch the user's usage details from Firebase
export const getUserUsageStatusController = async (req: Request, res: Response) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: 'User authentication required' });
        }

        // Get user's subscription status from Firebase
        const userRef = db.collection('users').doc(req.user.uid);
        const userData = await userRef.get();
        const userProfile = userData.data();
        const subscriptionTier = userProfile?.subscriptionTier || SubscriptionTier.FREE;

        // Get the limits based on subscription
        const limits = getSubscriptionLimits(subscriptionTier);

        // Get the user's current usage counter
        const usageCounter = await getUserUsageCounter(req.user.uid);

        // Calculate reset date
        const weekStartTimestamp = getCurrentWeekStartTimestamp();
        const resetDate = new Date(weekStartTimestamp + 7 * 24 * 60 * 60 * 1000);
        const resetDateString = resetDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });

        res.json({
            imageUploads: {
                used: usageCounter.imageUploads,
                remaining: Math.max(0, limits.maxImageUploads - usageCounter.imageUploads),
                total: limits.maxImageUploads
            },
            outfitGenerations: {
                used: usageCounter.outfitGenerations,
                remaining: Math.max(0, limits.maxOutfitGenerations - usageCounter.outfitGenerations),
                total: limits.maxOutfitGenerations
            },
            subscriptionTier: subscriptionTier,
            resetsOn: resetDateString
        });
    } catch (error) {
        console.error('Error getting user usage status:', error);
        res.status(500).json({
            error: 'Failed to get usage status',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const checkSubscriptions = async (req: Request, res: Response) => {
    try {
        console.log('Manually triggering subscription check...');
        const results = await checkExpiredSubscriptions();
        res.json({
            message: 'Check completed',
            results
        });
    } catch (error: any) {
        console.error('Error during manual check:', error);
        res.status(500).json({ error: 'Check failed', details: error.message });
    }
};
