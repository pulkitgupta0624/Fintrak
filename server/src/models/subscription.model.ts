import mongoose, { Schema } from "mongoose";
import { Env } from "../config/env.config.ts";

export enum SubscripionStatus {
    ACTIVE = 'active',
    CHECKOUT_INITIATED = 'checkout_initiated',
    TRIALING = 'trialing',
    PAST_DUES = 'past_due',
    CANCELLED = 'cancelled',
    TRIAL_EXPIRED = 'trial_expired',
    PAYMENT_FAILED = 'payment_failed'
}

export enum SubscriptionPlanEnum {
    MONTHLY = 'monthly',
    YEARLY = 'yearly'
}


export enum SubscriptionPriceEnum {
    MONTHLY = 999,
    YEARLY = 9999
}

export type SubscriptionStatusType = `${SubscripionStatus}`;
export type SubscriptionPlanType = `${SubscriptionPlanEnum}`;
export type SubscriptionPriceType = `${SubscriptionPriceEnum}`

export interface SubscriptionDocument extends Document {
    userId: mongoose.Types.ObjectId;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodStart: Date | null;
    stripeCurrentPeriodEnd: Date | null;
    trialStartsAt: Date;
    trialEndsAt: Date;
    trialDays: number;
    plan: SubscriptionPlanType | null;
    status: SubscriptionStatusType;
    upgradedAt: Date | null;
    cancelledAt: Date | null;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    isTrialActive(): boolean
}

const subscriptionSchema = new Schema<SubscriptionDocument>({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
    },
    stripeSubscriptionId: {
        type: String,
        default: null,
    },
    stripePriceId: {
        type: String,
        default: null,
    },
    stripeCurrentPeriodStart: {
        type: Date,
        default: null,
    },
    stripeCurrentPeriodEnd: {
        type: Date,
        required: false,
    },
    trialStartsAt: {
        type: Date,
        required: true,
        default: () => new Date(),
    },
    trialEndsAt: {
        type: Date,
        required: true,
    },
    trialDays: {
        type: Number,
        default: Number(Env.TRIAL_DAYS),
    },
    plan: {
        type: String,
        enum: Object.values(SubscriptionPlanEnum),
    },
    status: {
        type: String,
        enum: Object.values(SubscripionStatus),
        required: true,
        default: SubscripionStatus.TRIALING, // optional, but helpful
    },
    upgradedAt: {
        type: Date,
        default: null,
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {},
    },
},
    {
        timestamps: true
    }
)

subscriptionSchema.methods.isTrialActive = function () {
    if (!this.trialEndsAt || this.status !== SubscripionStatus.TRIALING) {
        return false;
    };
    return new Date() < this.trialEndsAt;
};

const SubscriptionModel = mongoose.model<SubscriptionDocument>("Subscription", subscriptionSchema);
export default SubscriptionModel;