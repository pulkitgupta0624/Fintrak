import { apiClient } from "@/app/api-client";
import {
  GetSubscriptionStatusResponse,
  UpgradeToProSubscriptionPayload,
} from "./billingType";
import { PLAN_TYPE } from "@/constant/plan.constant";

export const billingApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    upgradeToProSubscription: builder.mutation<
      { url: string },
      UpgradeToProSubscriptionPayload
    >({
      query: (body) => ({
        url: "/billing/subscription/upgrade",
        method: "POST",
        body,
      }),
      invalidatesTags: ["billingSubscription"],
    }),

    manageSubscriptionBillingPortal: builder.mutation<
      { url: string },
      { callbackUrl: string }
    >({
      query: (body) => ({
        url: "/billing/subscription/billing-portal",
        method: "POST",
        body,
      }),
    }),

    // ============================================================
    // FIX 1: Changed from builder.mutation → builder.query
    //   It's a GET request that fetches data. Using mutation meant:
    //   - No auto-fetch on component mount
    //   - No caching
    //   - Had to manually trigger with a function call
    //
    // FIX 2: URL changed from "/billing/subscription/upgrade" 
    //   → "/billing/subscription/status"
    //   The old URL was WRONG. Backend route is:
    //     billingRoutes.get("/subscription/status", ...)
    //   Hitting "/subscription/upgrade" with GET would 404
    // ============================================================
    getUserSubscriptionStatus: builder.query<
      GetSubscriptionStatusResponse,
      void
    >({
      query: () => ({
        url: "/billing/subscription/status",
        method: "GET",
      }),
      providesTags: ["billingSubscription"],
    }),

    switchToSubscriptionPlan: builder.mutation<
      { success: boolean; message: string },
      { newPlan: PLAN_TYPE }
    >({
      query: (body) => ({
        url: "/billing/subscription/switch-plan",
        method: "POST",
        body,
      }),
      invalidatesTags: ["billingSubscription"],
    }),
  }),
});

export const {
  useUpgradeToProSubscriptionMutation,
  useManageSubscriptionBillingPortalMutation,
  useGetUserSubscriptionStatusQuery, // Changed from useMutation hook to useQuery hook
  useSwitchToSubscriptionPlanMutation,
} = billingApi;
