import { z } from "zod";
import { SubscriptionPlanEnum } from "../models/subscription.model.ts";

const callbackUrlSchema = z.string().url();

const newPlanSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toLowerCase() : val),
  z.enum([SubscriptionPlanEnum.MONTHLY, SubscriptionPlanEnum.YEARLY])
);

export const upgradeToProSubscriptionSchema = z.object({
  callbackUrl: callbackUrlSchema,
  plan: newPlanSchema,
});

export const manageSubscriptionBillingPortalSchema = z.object({
  callbackUrl: callbackUrlSchema,
});

export const switchToSubscriptionPlanSchema = z.object({
  newPlan: newPlanSchema,
});

export type SwitchToSubscriptionPlanSchemaType = z.output<typeof switchToSubscriptionPlanSchema>;
export type UpgradeToProSubscriptionSchemaType = z.output<typeof upgradeToProSubscriptionSchema>;
export type ManageSubscriptionBillingPortalSchemaType = z.output<typeof manageSubscriptionBillingPortalSchema>;