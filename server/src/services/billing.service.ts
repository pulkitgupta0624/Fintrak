import { success } from "zod";
import { Env } from "../config/env.config.ts";
import { stripeClient } from "../config/stripe.config.ts";
import { planFeatures } from "../constant/subscription.ts";
import {
    SubscripionStatus,
    SubscriptionDocument,
    SubscriptionPlanEnum,
    SubscriptionPriceEnum
} from "../models/subscription.model.ts"
import UserModel from "../models/user.model.ts"
import { BadRequestException, InternalServerException, NotFoundException, UnauthorizedException } from "../utils/app-error.ts";
import { convertToDollarUnit } from "../utils/format-currency.ts";
import { SwitchToSubscriptionPlanSchemaType, UpgradeToProSubscriptionSchemaType } from "../validators/billing.validator.ts";

export const getUserSubscriptionStatusService = async (userId: string) => {
    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>("subscriptionId")
    if (!user || !user.subscriptionId) {
        throw new NotFoundException("No subscription found")
    }

    const subscriptionDoc = user.subscriptionId;
    const isTrialActive = subscriptionDoc.isTrialActive();

    const now = new Date();
    const daysLeft = subscriptionDoc.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((subscriptionDoc.trialEndsAt.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
        )
        : 0;

    const planData = {
        [SubscriptionPlanEnum.MONTHLY]: {
            price: convertToDollarUnit(SubscriptionPriceEnum.MONTHLY),
            billing: "month",
            savings: null,
            features: planFeatures[SubscriptionPlanEnum.MONTHLY]
        },
        [SubscriptionPlanEnum.YEARLY]: {
            price: convertToDollarUnit(SubscriptionPriceEnum.YEARLY),
            billing: "year",
            savings: "Save 17%",
            features: planFeatures[SubscriptionPlanEnum.YEARLY]
        }
    }

    const subscriptionData = {
        isTrialActive,
        currentPlan: subscriptionDoc.plan,
        trialEndsAt: subscriptionDoc.trialEndsAt,
        trialDays: subscriptionDoc.trialDays,
        status: subscriptionDoc.status,
        daysLeft: isTrialActive ? daysLeft : 0,
        planData
    }

    return {
        subscriptionData
    };
}

export const upgradeToProSubscriptionService = async (
    userId: string,
    body: UpgradeToProSubscriptionSchemaType
) => {
    const { callbackUrl, plan } = body;
    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>("subscriptionId")
    if (!user) throw new NotFoundException("User not found")

    if (user.subscriptionId?.status === SubscripionStatus.ACTIVE) {
        throw new UnauthorizedException("You are already on pro plan")
    }

    if (!user.stripeCustomerId) {
        const customer = await stripeClient.customers.create({
            email: user.email,
            name: user.name
        })
        user.stripeCustomerId = customer.id
        await user.save()
    }

    const _userId = user.id?.toString();
    const priceId =
        plan === SubscriptionPlanEnum.MONTHLY
            ? Env.STRIPE_MONTHLY_PLAN_PRICE_ID
            : Env.STRIPE_YEARLY_PLAN_PRICE_ID

    const session = await stripeClient.checkout.sessions.create({
        mode: "subscription",
        customer: user.stripeCustomerId,
        success_url: `${callbackUrl}?success=true&plan=${plan}`,
        cancel_url: `${callbackUrl}?success=false`,
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        subscription_data: {
            metadata: {
                userId: _userId,
                plan
            }
        }
    })

    return { url: session.url }
}

export const manageSubscriptionBillingPortalService = async (
    userId: string,
    callbackUrl: string
) => {
    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>("subscriptionId")
    if (!user) throw new NotFoundException("User not found")

    if (!user.stripeCustomerId) {
        const customer = await stripeClient.customers.create({
            email: user.email,
            name: user.name
        })
        user.stripeCustomerId = customer.id
        await user.save()
    }

    try {
        const session = await stripeClient.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: callbackUrl
        })

        if (!session || !session.url) {
            throw new InternalServerException("Billing Portal URL generate error")
        }

        return session.url

    } catch (error) {
        throw new InternalServerException("Billing Portal URL generate error")
    }
}

export const switchToSubscriptionPlanService = async (
    userId: string,
    body: SwitchToSubscriptionPlanSchemaType
) => {
    const { newPlan } = body;

    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>("subscriptionId")

    if (!user || !user.subscriptionId.stripeSubscriptionId) {
        throw new UnauthorizedException(
            "You are not subscribed to any plan"
        )
    }

    if (user.subscriptionId.plan === newPlan) {
        throw new BadRequestException(
            `You are already on the ${newPlan} plan`
        )
    }

    const subscription = await stripeClient.subscriptions.retrieve(
        user.subscriptionId.stripeSubscriptionId
    )

    const priceId =
        newPlan === SubscriptionPlanEnum.YEARLY
            ? Env.STRIPE_YEARLY_PLAN_PRICE_ID
            : Env.STRIPE_MONTHLY_PLAN_PRICE_ID

    if (!priceId)
        throw new InternalServerException("Subscription Price configure error")

    await stripeClient.subscriptions.update(subscription.id, {
        items: [
            {
                id: subscription.items.data[0].id,
                price: priceId
            }
        ],
        proration_behavior: "create_prorations",
        payment_behavior: "allow_incomplete",
        metadata: {
            userId: user.id,
            plan: newPlan
        }
    })

    return {
        success: true,
        message: `You have successfully switched to ${newPlan} plan`
    }
}
