import { Router } from "express";
import { 
    getUserSubscriptionStatusController,
    manageSubscriptionBillingPortalController, 
    switchToSubscriptionPlanController, 
    upgradeToProSubscriptionController 
} from "../controllers/billing.controller.ts";

const billingRoutes = Router();

billingRoutes.post("/subscription/upgrade", upgradeToProSubscriptionController);

billingRoutes.post("/subscription/billing-portal", manageSubscriptionBillingPortalController);

billingRoutes.get("/subscription/status", getUserSubscriptionStatusController);

billingRoutes.post("/subscription/switch-plan", switchToSubscriptionPlanController);

export default billingRoutes