export const PLANS = {
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY'
}

export type PLAN_TYPE = (typeof PLANS)[keyof typeof PLANS]