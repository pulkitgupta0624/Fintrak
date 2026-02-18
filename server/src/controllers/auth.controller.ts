import { HTTPSTATUS } from "../config/http.config.ts";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.ts";
import { Request, Response } from "express";
import { loginSchema, registerSchema } from "../validators/auth.validator.ts";
import { loginService, registerService } from "../services/auth.service.ts";

export const registerController = asyncHandler(
    async (req: Request, res: Response) => {
        const body = registerSchema.parse(req.body);

        const result = await registerService(body);

        return res.status(HTTPSTATUS.CREATED).json({
            message: "User Registered Successfully",
            data: result
        });
    }
)

export const loginController = asyncHandler(
    async (req: Request, res: Response) => {
        const body = loginSchema.parse({
            ...req.body
        })
        const { user, accessToken, expiresAt, reportSetting } =
            await loginService(body);

        return res.status(HTTPSTATUS.OK).json({ 
            message: "User Logged In Successfully",
            user, 
            accessToken, 
            expiresAt, 
            reportSetting 
        });
    }
)   