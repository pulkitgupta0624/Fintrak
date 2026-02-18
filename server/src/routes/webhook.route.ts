import express, { Request, Response, Router } from "express";
import { stripeWebHookHandler } from "../webhooks/stripe.webhook.ts";

const webhookRoutes = Router();

webhookRoutes.post(
    "/stripe",
    express.raw({ type: "application/json" }),
    async(req: Request, res: Response) => {
        await stripeWebHookHandler(req, res)
    }
)

export default webhookRoutes