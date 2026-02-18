// ============================================================
// FIX: Values were UPPERCASE ('MONTHLY', 'YEARLY') but backend
//   SubscriptionPlanEnum uses lowercase ('monthly', 'yearly').
//   When backend returns currentPlan: 'monthly', comparing with
//   PLANS.MONTHLY === 'MONTHLY' would always fail!
// ============================================================
export const PLANS = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

export type PLAN_TYPE = (typeof PLANS)[keyof typeof PLANS];
