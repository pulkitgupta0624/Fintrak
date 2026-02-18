import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { PLAN_TYPE, PLANS } from "@/constant/plan.constant";
import { PlanData } from "@/features/billing/billingType";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader } from "lucide-react";

interface BillingPlanCardProps {
  planKey: string;
  plan: PlanData;
  isCurrentPlan: boolean;
  isActive: boolean;
  isTrialActive: boolean;
  onUpgrade: (plan: PLAN_TYPE) => void;
  onSwitch: (plan: PLAN_TYPE) => void;
  isUpgrading: boolean;
  isSwitching: boolean;
}

const BillingPlanCard = ({
  planKey,
  plan,
  isCurrentPlan,
  isActive,
  isTrialActive,
  onUpgrade,
  onSwitch,
  isUpgrading,
  isSwitching,
}: BillingPlanCardProps) => {
  const isYearly = planKey === PLANS.YEARLY;
  const planLabel = isYearly ? "Yearly" : "Monthly";

  const handleClick = () => {
    if (isActive && !isCurrentPlan) {
      onSwitch(planKey as PLAN_TYPE);
    } else if (!isActive) {
      onUpgrade(planKey as PLAN_TYPE);
    }
  };

  const getButtonLabel = () => {
    if (isCurrentPlan && isActive) return "Current Plan";
    if (isActive && !isCurrentPlan) return "Switch to this Plan";
    if (isTrialActive) return "Upgrade Now";
    return "Get Started";
  };

  const isDisabled = (isCurrentPlan && isActive) || isUpgrading || isSwitching;
  const isLoading = isUpgrading || isSwitching;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        isCurrentPlan && isActive
          ? "border-primary ring-1 ring-primary"
          : "hover:border-primary/50",
        isYearly && "border-green-500/50"
      )}
    >
      {/* Recommended badge for yearly */}
      {isYearly && (
        <div className="absolute top-0 right-0">
          <Badge className="rounded-none rounded-bl-md bg-green-600 hover:bg-green-600 text-white text-xs px-3 py-1">
            BEST VALUE
          </Badge>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && isActive && (
        <div className="absolute top-0 left-0">
          <Badge className="rounded-none rounded-br-md bg-primary hover:bg-primary text-primary-foreground text-xs px-3 py-1">
            CURRENT
          </Badge>
        </div>
      )}

      <CardContent className="pt-8 pb-6 px-6">
        {/* Plan name */}
        <h3 className="text-lg font-semibold mb-1">{planLabel} Plan</h3>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground text-sm">
            /{plan.billing}
          </span>
        </div>

        {/* Savings badge */}
        {plan.savings && (
          <Badge variant="secondary" className="mb-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {plan.savings}
          </Badge>
        )}

        {!plan.savings && <div className="mb-4" />}

        {/* Features */}
        <ul className="space-y-2.5 mb-6">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button
          className={cn(
            "w-full",
            isYearly && !isCurrentPlan && "bg-green-600 hover:bg-green-700 text-white"
          )}
          variant={isCurrentPlan && isActive ? "outline" : "default"}
          disabled={isDisabled}
          onClick={handleClick}
        >
          {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
          {getButtonLabel()}
        </Button>
      </CardContent>
    </Card>
  );
};

export default BillingPlanCard;
