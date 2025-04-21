import express from 'express';
import { webhookController } from "../controllers/webhook.controller";

const router = express.Router();

router.post(
    '/',
    express.raw({ type: 'application/json' }),
    webhookController
);

export default router;