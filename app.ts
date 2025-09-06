import dotenv from 'dotenv';
import express, { Application } from 'express';
import cors from 'cors';

import imageRoutes from './src/routes/image.route';
import outfitRoutes from './src/routes/outfit.route';
import subscriptionRoute from "./src/routes/subscription.route";
import webhookRoute from "./src/routes/webhook.route";

import { initializeScheduledTasks } from "./src/utils/scheduler";

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3001;
const frontendUrl = process.env.FRONTEND_URL;
const appUrl = process.env.APP_URL;

app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRoute);

app.use(cors({
    origin: frontendUrl || appUrl,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/images', imageRoutes);
app.use('/api', outfitRoutes);
app.use('/api/subscribe', subscriptionRoute);

initializeScheduledTasks();

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});

export default app;