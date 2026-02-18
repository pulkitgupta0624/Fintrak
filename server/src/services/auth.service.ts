import mongoose from "mongoose";
import { LoginSchemaType, RegisterSchemaType } from "../validators/auth.validator.ts";
import UserModel from "../models/user.model.ts";
import { NotFoundException, UnauthorizedException } from "../utils/app-error.ts";
import ReportSettingModel, { ReportFrequencyEnum } from "../models/report-setting.model.ts";
import { calculateNextReportDate } from "../utils/helper.ts";
import { signJwtToken } from "../utils/jwt.ts";
import { stripeClient } from "../config/stripe.config.ts";
import { Env } from "../config/env.config.ts";
import SubscriptionModel, { SubscripionStatus } from "../models/subscription.model.ts";

const TRIAL_DAYS = Number(Env.TRIAL_DAYS);

export const registerService = async (body: RegisterSchemaType) => {
    const { email } = body;

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const existingUser = await UserModel.findOne({ email }).session(session);
            if (existingUser) throw new UnauthorizedException("User already exists");

            const newUser = new UserModel({
                ...body
            });
            await newUser.save({ session });

            const customer = await stripeClient.customers.create({
                email: newUser.email,
                name: newUser.name
            })

            newUser.stripeCustomerId = customer.id;
            await newUser.save({ session });

            const _userId = newUser.id.toString();

            // ============================================================
            // FIX: Was using ONE_MINUTES_IN_SECONDS = 1*60 = 60 seconds
            //      This meant TRIAL_DAYS=7 gave only 7 MINUTES of trial!
            //      Now correctly using 24*60*60 = 86400 seconds per day
            // ============================================================
            const ONE_DAY_IN_SECONDS = 24 * 60 * 60; // 86400 seconds = 1 day
            const trialEndDate = Math.floor(Date.now() / 1000) + TRIAL_DAYS * ONE_DAY_IN_SECONDS;

            const stripeSubscription = await stripeClient.subscriptions.create({
                customer: customer.id,
                items: [{ price: Env.STRIPE_MONTHLY_PLAN_PRICE_ID }],
                trial_end: trialEndDate,
                trial_settings: {
                    end_behavior: {
                        missing_payment_method: "cancel"
                    }
                },
                metadata: {
                    userId: _userId
                }
            })

            const subscriptionDoc = new SubscriptionModel({
                userId: newUser._id,
                status: SubscripionStatus.TRIALING,
                plan: null,
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: stripeSubscription.items.data[0].price.id,
                trialStartsAt: new Date(stripeSubscription.trial_start! * 1000),
                trialEndsAt: new Date(stripeSubscription.trial_end! * 1000),
                trialDays: TRIAL_DAYS,
            });

            await subscriptionDoc.save({ session })

            newUser.subscriptionId = subscriptionDoc._id as mongoose.Types.ObjectId;
            await newUser.save({ session });

            const reportSetting = new ReportSettingModel({
                userId: newUser._id,
                frequency: ReportFrequencyEnum.MONTHLY,
                isEnabled: true,
                nextReportDate: calculateNextReportDate(),
                lastSentDate: null
            });

            await reportSetting.save({ session });

            return { user: newUser.omitPassword() };
        })
    } catch (error) {
        throw error;
    } finally {
        await session.endSession();
    }
};

export const loginService = async (body: LoginSchemaType) => {
    const { email, password } = body;
    const user = await UserModel.findOne({ email });
    if (!user) throw new NotFoundException("Email/password not found");

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid)
        throw new UnauthorizedException("Invalid email/password");

    const { token, expiresAt } = signJwtToken({ userId: user.id });

    const reportSetting = await ReportSettingModel.findOne(
        {
            userId: user.id,
        },
        { _id: 1, frequency: 1, isEnabled: 1 }
    ).lean();

    return {
        user: user.omitPassword(),
        accessToken: token,
        expiresAt,
        reportSetting,
    };
};
