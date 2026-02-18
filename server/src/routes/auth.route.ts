import { Router } from "express";
import { registerController, loginController } from "../controllers/auth.controller.ts";

const authRoutes = Router();

authRoutes.post("/register", registerController)
authRoutes.post("/login", loginController)

export default authRoutes