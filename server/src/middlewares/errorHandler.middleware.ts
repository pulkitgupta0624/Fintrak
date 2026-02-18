import { ErrorRequestHandler } from "express"
import { HTTPSTATUS } from "../config/http.config.js";
import { AppError } from "../utils/app-error.js";
import { Response } from "express";
import { ZodError, z } from "zod";
import { ErrorCodeEnum } from "../enums/error-code.enum.ts";
import { MulterError } from "multer";

const formatZodError = (res: Response, error: z.ZodError) => {
    const errors = error?.issues?.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
    }));
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: "Validation Error",
        errorCode: ErrorCodeEnum.VALIDATION_ERROR,
        errors: errors
    })
}

const handleMulterError = (error: MulterError) => {
    const messages = {
        LIMIT_UNEXPECTED_FILE: "Invalid file field name. Please use 'file",
        LIMIT_FILE_SIZE: "File size limit exceeded",
        LIMIT_FILE_COUNT: "File count limit exceeded",
        default: "File upload error"
    };

    return {
        status: HTTPSTATUS.BAD_REQUEST,
        message: messages[error.code as keyof typeof messages] || messages.default,
        error: error.message
    }
}

export const errorHandler: ErrorRequestHandler = (
    error,
    req,
    res,
    next
): any => {
    console.log("Error occured on PATH: ", req.path, "Error: ", error);

    if(error instanceof ZodError) {
        return formatZodError(res, error)
    }

    if(error instanceof MulterError) {  
        const { status, message, error: err } = handleMulterError(error);
        return res.status(status).json({
            message,
            error: err,
            errorCode: ErrorCodeEnum.FILE_UPLOAD_ERROR
        })
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            message: error.message,
            errorCode: error.errorCode
        })
    }

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Intenal Server Error",
        error: error?.message || "Unknown error occurred"
    })
}