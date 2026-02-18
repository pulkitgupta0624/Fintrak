import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config.ts";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.ts";
import {
    getUserSubscriptionStatusService,
    manageSubscriptionBillingPortalService,
    switchToSubscriptionPlanService,
    upgradeToProSubscriptionService
} from "../services/billing.service.ts";
import {
    manageSubscriptionBillingPortalSchema,
    switchToSubscriptionPlanSchema,
    upgradeToProSubscriptionSchema
} from "../validators/billing.validator.ts";

export const getUserSubscriptionStatusController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;

        const {subscriptionData} = await getUserSubscriptionStatusService(userId);
        return res.status(HTTPSTATUS.OK).json({
            message: "Subscription Fetched Successfully",
            data : subscriptionData
        })
    }
)

export const upgradeToProSubscriptionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const body = upgradeToProSubscriptionSchema.parse(req.body);

        const { url } = await upgradeToProSubscriptionService(userId, body);

        return res.status(HTTPSTATUS.OK).json({
            message: "Payment URL generated successfully",
            url,
        })
    }
)

export const manageSubscriptionBillingPortalController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const body = manageSubscriptionBillingPortalSchema.parse(req.body);

        const url = await manageSubscriptionBillingPortalService(
            userId,
            body.callbackUrl
        );
        return res.status(HTTPSTATUS.OK).json({
            message: "Billing Portal URL generated successfully",
            url,
        })
    }
)

export const switchToSubscriptionPlanController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const body = switchToSubscriptionPlanSchema.parse(req.body);

        await switchToSubscriptionPlanService(userId, body);
        return res.status(HTTPSTATUS.OK).json({
            message: "Subscription plan switched Successfully",
        })
    }
)