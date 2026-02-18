import { Response, Request } from "express"
import Stripe from "stripe";
import { stripeClient } from "../config/stripe.config.ts";
import { Env } from "../config/env.config.ts";
import SubscriptionModel,
{
    SubscripionStatus,
    SubscriptionPlanEnum
} from "../models/subscription.model.ts";
import { HTTPSTATUS } from "../config/http.config.ts";

export const stripeWebHookHandler = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;

    try {
        event = stripeClient.webhooks.constructEvent(
            req.body,
            sig,
            Env.STRIPE_WEBHOOK_SECRET
        )
    } catch (error: any) {
        return res.status(400).send(`Webhook Error: ${error.message}`)
    }

    try {
        switch (event.type) {
            case "customer.subscription.trial_will_end":
                console.log(
                    `Trial will end for user ${(event.data.object as Stripe.Subscription).metadata?.userId}`
                )
                break;
            case "checkout.session.completed":
                await handleCheckoutSessionCompleted(
                    event.data.object as Stripe.Checkout.Session
                );
                break;
            case "invoice.payment_succeeded":
                await handleInvoicePaymentSucceeded(
                    event.data.object as Stripe.Invoice
                )
                break;

            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(
                    event.data.object as Stripe.Invoice
                )
                break;

            case "customer.subscription.updated":
                await handleCustomerSubscriptionUpdated(
                    event.data.object as Stripe.Subscription
                )
                break;

            case "customer.subscription.deleted":
                await handleCustomerSubscriptionDeleted(
                    event.data.object as Stripe.Subscription
                )
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        res.status(HTTPSTATUS.OK).json({ received: true });
    } catch (error: any) {
        console.error(`Webhook handler error for ${event.type}:`, error);
        res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
}

async function handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
) {
    console.log(`Inside checkout.session.completed`);
    const stripeSubscriptionId = session.subscription as string;
    if (!stripeSubscriptionId) return;

    const subscription =
        await stripeClient.subscriptions.retrieve(stripeSubscriptionId);

    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const status = SubscripionStatus.ACTIVE;

    const update = {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        plan: getPlan(subscription),
        stripeCurrentPeriodStart: new Date(
            subscription.items.data[0]?.current_period_start * 1000
        ),
        stripeCurrentPeriodEnd: new Date(
            subscription.items.data[0]?.current_period_end * 1000
        ),
        status,
        upgradedAt: new Date(),
    };

    await SubscriptionModel.findOneAndUpdate(
        {
            userId,
            status: { $ne: SubscripionStatus.ACTIVE }
        },
        { $set: update },
        { upsert: true }
    );
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    console.log(
        `Inside invoice.payment_succeeded`,
        `Amount: ${invoice.amount_paid / 100}`
    );
    const subscriptionId = invoice.lines.data[0]?.subscription as string;
    if (!subscriptionId) return;

    const subscription =
        await stripeClient.subscriptions.retrieve(subscriptionId);

    const userId = subscription.metadata?.userId;
    if (!userId) return;

    if (subscription.status === "trialing" && invoice.amount_paid === 0) {
        console.log(`skipping $0 invoice (trial setup)`)
        return;
    }

    const update = {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        plan: getPlan(subscription),
        stripeCurrentPeriodStart: new Date(
            subscription.items.data[0]?.current_period_start * 1000
        ),
        stripeCurrentPeriodEnd: new Date(
            subscription.items.data[0]?.current_period_end * 1000
        ),
        status: SubscripionStatus.ACTIVE,
        upgradedAt: new Date(),
    };

    await SubscriptionModel.findOneAndUpdate(
        {
            userId,
            status: { $ne: SubscripionStatus.ACTIVE }
        },
        { $set: update },
        { upsert: true }
    );

    console.log(`Invoice payment succeeded for user ${userId}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    console.log(`Inside invoice.payment_failed`);
    const subscriptionId = invoice.lines.data[0]?.subscription as string;
    if (!subscriptionId) return;

    const subscription =
        await stripeClient.subscriptions.retrieve(subscriptionId);

    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await SubscriptionModel.findOneAndUpdate(
        { userId },
        {
            $set: {
                plan: null,
                status: SubscripionStatus.PAYMENT_FAILED
            }
        },
    );

    console.log(`Invoice payment failed for user ${userId}`);
}

async function handleCustomerSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription
) {
    console.log(`Inside customer.subscription.updated`, stripeSubscription.status);
    const userId = stripeSubscription.metadata?.userId;

    if (stripeSubscription.status === "trialing") {
        console.log("Skipping Trialing subscription");
        return;
    }

    const priceId = stripeSubscription.items.data[0].price.id;
    const plan = getPlan(stripeSubscription);

    const currentSub = await SubscriptionModel.findOne({ userId });
    if (!currentSub) return

    const isPlanSwitch =
        currentSub?.plan !== plan || currentSub?.stripePriceId !== priceId;


    if (isPlanSwitch && stripeSubscription.status === "active") {
        await SubscriptionModel.findOneAndUpdate(
            { userId },
            {
                $set: {
                    plan,
                    stripePriceId: priceId,
                    stripeCurrentPeriodStart: new Date(
                        stripeSubscription.items.data[0]?.current_period_start * 1000
                    ),
                    stripeCurrentPeriodEnd: new Date(
                        stripeSubscription.items.data[0]?.current_period_end * 1000
                    ),
                }
            },
            { upsert: true }
        );

        console.log(`Plan switch for user ${userId} from ${currentSub?.plan} to ${plan}`);
    } else {
        console.log(`Plan not changed for user ${userId}`);
    }
}

async function handleCustomerSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription
) {
    console.log(`Inside customer.subscription.deleted`, stripeSubscription.status);
    const userId = stripeSubscription.metadata?.userId;
    if (!userId) return;

    const isTrialExpired =
        stripeSubscription.trial_end && stripeSubscription.status === "canceled";

    await SubscriptionModel.findOneAndUpdate(
        { userId },
        {
            $set: {
                status: isTrialExpired
                    ? SubscripionStatus.TRIAL_EXPIRED
                    : SubscripionStatus.CANCELLED,
                plan: null,
                ...(!isTrialExpired && { cancelledAt: new Date() })
            }
        },
    );

    console.log(`Subscription deleted for user ${userId}`);
}

function getPlan(subscription: Stripe.Subscription): SubscriptionPlanEnum {
    const priceId = subscription.items.data[0].price.id;
    if (priceId === Env.STRIPE_YEARLY_PLAN_PRICE_ID) {
        return SubscriptionPlanEnum.YEARLY;
    }
    return SubscriptionPlanEnum.MONTHLY; // default fallback
}
