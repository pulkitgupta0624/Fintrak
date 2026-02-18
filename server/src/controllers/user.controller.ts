import { asyncHandler } from "../middlewares/asyncHandler.middleware.ts";
import { Request, Response } from "express";
import {
    findByIdUserService,
    updateUserService
} from "../services/user.service.ts";
import { HTTPSTATUS } from "../config/http.config.ts";
import { updateUserSchema } from "../validators/user.validator.ts";

export const getCurrentUserController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;

        const user = await findByIdUserService(userId);
        return res.status(HTTPSTATUS.OK).json({
            message: "User Fetched Successfully",
            user
        })
    }
)

export const updateUserController = asyncHandler(
    async (req: Request, res: Response) => {
        const body = updateUserSchema.parse(req.body);
        const userId = req.user?._id
        const profilePic = req.file

        const user = await updateUserService(userId, body, profilePic);

        return res.status(HTTPSTATUS.OK).json({
            message: "User Updated Successfully",
            user
        })
    }
)