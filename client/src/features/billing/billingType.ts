import { PLAN_TYPE } from "@/constant/plan.constant";

export interface UpgradeToProSubscriptionPayload {
  callbackUrl: string;
  plan: PLAN_TYPE;
}

export interface PlanData {
  price: string;
  billing: string;
  savings: string | null;
  features: string[];
}

export interface SubscriptionData {
  isTrialActive: boolean;
  currentPlan: string | null; // Backend returns lowercase: "monthly" | "yearly" | null
  trialEndsAt: string;
  trialDays: number;
  status: string;
  daysLeft: number;
  planData: {
    [key: string]: PlanData; // Backend keys are lowercase: "monthly", "yearly"
  };
}

export interface GetSubscriptionStatusResponse {
  message: string;
  data: SubscriptionData;
}
