import { db } from '../config/firebase';
import { SubscriptionTier } from './subscription.service';

export const checkExpiredSubscriptions = async (): Promise<{
    downgraded: Array<{ userId: string, previousTier: string }>,
    needsCheck: Array<{ userId: string, tier: string, status: string, periodEnd: number }>
}> => {
    const now = Math.floor(Date.now() / 1000);
    const results = {
        downgraded: [] as Array<{ userId: string, previousTier: string }>,
        needsCheck: [] as Array<{ userId: string, tier: string, status: string, periodEnd: number }>
    };

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef
            .where('subscriptionTier', 'in', [SubscriptionTier.BASIC, SubscriptionTier.PREMIUM])
            .where('currentPeriodEnd', '<=', now)
            .get();

        if (snapshot.empty) {
            console.log('No expired subscriptions found');
            return results;
        }

        // Process each user with an expired subscription
        const batch = db.batch();

        snapshot.forEach(doc => {
            const userData = doc.data();

            // Check if the subscription is set to auto-renew
            if (userData.cancelAtPeriodEnd === true ||
                userData.subscriptionStatus !== 'active') {

                batch.update(doc.ref, {
                    subscriptionTier: SubscriptionTier.FREE,
                    subscriptionStatus: 'expired'
                });

                results.downgraded.push({
                    userId: doc.id,
                    previousTier: userData.subscriptionTier
                });

                console.log(`Scheduled downgrade for user ${doc.id} from ${userData.subscriptionTier} to FREE`);
            } else {
                results.needsCheck.push({
                    userId: doc.id,
                    tier: userData.subscriptionTier,
                    status: userData.subscriptionStatus,
                    periodEnd: userData.currentPeriodEnd
                });

                console.log(`User ${doc.id} has passed period end but may still have an active subscription. Manual check required.`);
            }
        });

        if (results.downgraded.length > 0) {
            await batch.commit();
            console.log(`Successfully downgraded ${results.downgraded.length} expired subscriptions`);
        }

        return results;
    } catch (error) {
        console.error('Error checking expired subscriptions:', error);
        throw error;
    }
};