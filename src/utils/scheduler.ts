import cron from 'node-cron';
import { checkExpiredSubscriptions } from '../services/subscriptionChecker.service';

export const initializeScheduledTasks = () => {
    // Schedule the subscription check to run at midnight every day
    cron.schedule('0 0 * * *', async () => {
        console.log('Running scheduled subscription check...');
        try {
            const results = await checkExpiredSubscriptions();
            console.log(`Scheduled task completed. Downgraded ${results.downgraded.length} subscriptions.`);
        } catch (error) {
            console.error('Error in scheduled subscription check:', error);
        }
    });

    console.log('Scheduled tasks initialized');
};