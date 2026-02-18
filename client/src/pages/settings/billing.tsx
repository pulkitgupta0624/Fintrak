import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_TYPE } from "@/constant/plan.constant";
import {
  useGetUserSubscriptionStatusQuery,
  useUpgradeToProSubscriptionMutation,
  useManageSubscriptionBillingPortalMutation,
  useSwitchToSubscriptionPlanMutation,
} from "@/features/billing/billingAPI";
import BillingPlanCard from "./_components/billing-plan-card";
import { toast } from "sonner";
import {
  AlertCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Loader,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";

const Billing = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch subscription status
  const {
    data: subscriptionResponse,
    isLoading,
    isError,
    refetch,
  } = useGetUserSubscriptionStatusQuery();

  const subscriptionData = subscriptionResponse?.data;

  // Mutations
  const [upgradeToProSubscription, { isLoading: isUpgrading }] =
    useUpgradeToProSubscriptionMutation();

  const [manageSubscriptionBillingPortal, { isLoading: isManaging }] =
    useManageSubscriptionBillingPortalMutation();

  const [switchToSubscriptionPlan, { isLoading: isSwitching }] =
    useSwitchToSubscriptionPlanMutation();

  // Handle success/failure from Stripe redirect
  useEffect(() => {
    const success = searchParams.get("success");
    const plan = searchParams.get("plan");

    if (success === "true") {
      toast.success(
        `Successfully upgraded to ${plan || "Pro"} plan!`
      );
      refetch();
      // Clean up URL params
      setSearchParams({});
    } else if (success === "false") {
      toast.error("Payment was cancelled. Please try again.");
      setSearchParams({});
    }
  }, [searchParams, refetch, setSearchParams]);

  // Handlers
  const handleUpgrade = async (plan: PLAN_TYPE) => {
    try {
      const callbackUrl = window.location.href.split("?")[0]; // Current URL without params
      const result = await upgradeToProSubscription({
        callbackUrl,
        plan,
      }).unwrap();

      if (result.url) {
        window.location.href = result.url; // Redirect to Stripe Checkout
      }
    } catch (error: any) {
      toast.error(
        error?.data?.message || "Failed to initiate upgrade. Please try again."
      );
    }
  };

  const handleSwitch = async (newPlan: PLAN_TYPE) => {
    try {
      const result = await switchToSubscriptionPlan({ newPlan }).unwrap();
      toast.success(result.message || "Plan switched successfully!");
      refetch();
    } catch (error: any) {
      toast.error(
        error?.data?.message || "Failed to switch plan. Please try again."
      );
    }
  };

  const handleManageBilling = async () => {
    try {
      const callbackUrl = window.location.href.split("?")[0];
      const result = await manageSubscriptionBillingPortal({
        callbackUrl,
      }).unwrap();

      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          "Failed to open billing portal. Please try again."
      );
    }
  };

  // Status helpers
  const isActive = subscriptionData?.status === "active";
  const isTrialActive = subscriptionData?.isTrialActive ?? false;
  const isTrialExpired = subscriptionData?.status === "trial_expired";
  const isCancelled = subscriptionData?.status === "cancelled";
  const isPaymentFailed = subscriptionData?.status === "payment_failed";

  const getStatusBadge = () => {
    if (isActive)
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    if (isTrialActive)
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">
          <Clock className="h-3 w-3 mr-1" />
          Trial Active
        </Badge>
      );
    if (isTrialExpired)
      return (
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          Trial Expired
        </Badge>
      );
    if (isCancelled)
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    if (isPaymentFailed)
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          Payment Failed
        </Badge>
      );
    return (
      <Badge variant="secondary">
        {subscriptionData?.status || "Unknown"}
      </Badge>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Billing</h3>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>
        <Separator />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !subscriptionData) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Billing</h3>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>
        <Separator />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load subscription information. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing information
        </p>
      </div>
      <Separator />

      {/* Trial / Status Alert */}
      {isTrialActive && subscriptionData.daysLeft > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Free Trial</AlertTitle>
          <AlertDescription>
            You have{" "}
            <span className="font-semibold">
              {subscriptionData.daysLeft} day
              {subscriptionData.daysLeft !== 1 ? "s" : ""}
            </span>{" "}
            remaining on your free trial. Upgrade now to keep using all
            features.
          </AlertDescription>
        </Alert>
      )}

      {isTrialExpired && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Trial Expired</AlertTitle>
          <AlertDescription>
            Your free trial has expired. Please upgrade to continue using
            premium features.
          </AlertDescription>
        </Alert>
      )}

      {isPaymentFailed && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Failed</AlertTitle>
          <AlertDescription>
            Your last payment failed. Please update your payment method to
            continue using premium features.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Subscription Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">Current Subscription</h4>
                {getStatusBadge()}
              </div>
              <p className="text-sm text-muted-foreground">
                {isActive && subscriptionData.currentPlan
                  ? `You are on the ${subscriptionData.currentPlan} plan`
                  : isTrialActive
                  ? `Free trial · ${subscriptionData.daysLeft} days remaining`
                  : "No active subscription"}
              </p>
              {subscriptionData.trialEndsAt && isTrialActive && (
                <p className="text-xs text-muted-foreground">
                  Trial ends on{" "}
                  {new Date(subscriptionData.trialEndsAt).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              )}
            </div>

            {/* Manage Billing Button - only for active subscribers */}
            {isActive && (
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={isManaging}
              >
                {isManaging ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Manage Billing
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div>
        <h4 className="text-base font-medium mb-4">
          {isActive ? "Switch Plan" : "Choose a Plan"}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptionData.planData &&
            Object.entries(subscriptionData.planData).map(
              ([planKey, planInfo]) => (
                <BillingPlanCard
                  key={planKey}
                  planKey={planKey}
                  plan={planInfo}
                  isCurrentPlan={subscriptionData.currentPlan === planKey}
                  isActive={isActive}
                  isTrialActive={isTrialActive}
                  onUpgrade={handleUpgrade}
                  onSwitch={handleSwitch}
                  isUpgrading={isUpgrading}
                  isSwitching={isSwitching}
                />
              )
            )}
        </div>
      </div>

      {/* Manage Billing Section for active users */}
      {isActive && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="font-medium text-sm">
                  Need to update payment method or cancel?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Use the Stripe Billing Portal to manage your payment details,
                  invoices, and subscription.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleManageBilling}
                disabled={isManaging}
              >
                {isManaging ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Open Billing Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Billing;
