import express from 'express';
import {
    cancelSubscription, createCustomer,
    createSession, createSetupIntent,
    createSubscription,
    getSubscriptionStatus, getUserUsageStatusController, pricesConfig, reactivateSubscription,
    sessionStatus, verifyPayment, checkSubscriptions
} from '../controllers/subscription.controller';
import { authenticateUser } from "../middlewares/auth.middleware";

const router = express.Router();

router.get('/config', pricesConfig);
router.post('/create-customer', createCustomer);
router.post('/create-subscription', authenticateUser, createSubscription);
router.post('/create-checkout-session', createSession);
router.post('/create-setup-intent', authenticateUser, createSetupIntent);
router.post('/user/cancel', authenticateUser, cancelSubscription);
router.post('/user/resume', authenticateUser, reactivateSubscription);
router.get('/user/status', authenticateUser, getSubscriptionStatus);
router.get('/user/usage', authenticateUser, getUserUsageStatusController);
router.get('/verify-payment', authenticateUser, verifyPayment);
router.get('/session-status', sessionStatus);
router.get('/subscription-status', getSubscriptionStatus);
router.get('/debug/check-subscriptions', checkSubscriptions);

export default router;