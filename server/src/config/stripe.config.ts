import Stripe from 'stripe';
import { Env } from './env.config.js'; 

export const stripeClient = new Stripe(Env.
    STRIPE_SECRET_KEY, {
        apiVersion: "2026-01-28.clover",
        typescript: true,
        maxNetworkRetries: 3,
        timeout: 30000
    }
);