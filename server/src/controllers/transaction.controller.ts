import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.ts";
import {
    createTransactionService,
    getTransactionByIdService,
    bulkDeleteTransactionService,
    bulkTransactionService,
    updateTransactionService,
    deleteTransactionService,
    duplicateTransactionService,
    getAllTransactionService,
} from "../services/transaction.service.ts";
import {
    createTransactionSchema,
    transactionIdSchema,
    updateTransactionSchema,
    bulkTransactionSchema,
    bulkDeleteTransactionSchema
} from "../validators/transaction.validator.ts";
import { HTTPSTATUS } from "../config/http.config.ts";
import { TransactionTypeEnum } from "../models/transaction.model.ts";
import { scanReceiptService } from '../services/transaction.service.ts';

export const createTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const body = createTransactionSchema.parse(req.body);
        const userId = req.user?._id;

        const transaction = await createTransactionService(body, userId);

        return res.status(HTTPSTATUS.CREATED).json({
            message: "Transaction Created Successfully",
            transaction
        })
    }
);

export const getAllTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;

        const filters = {
            keyword: req.query.keyword as string | undefined,
            type: req.query.type as keyof typeof TransactionTypeEnum | undefined,
            recurringStatus: req.query.recurringStatus as
                | "RECURRING"
                | "NON_RECURRING"
                | undefined,
        };

        const pagination = {
            pageSize: parseInt(req.query.pageSize as string) || 20,
            pageNumber: parseInt(req.query.pageNumber as string) || 1,
        };

        const result = await getAllTransactionService(userId, filters, pagination);

        return res.status(HTTPSTATUS.OK).json({
            message: "Transactions Fetched Successfully",
            ...result
        });
    }
)

export const getTransactionByIdController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const transactionId = transactionIdSchema.parse(req.params.id);

        const transaction = await getTransactionByIdService(userId, transactionId);

        return res.status(HTTPSTATUS.OK).json({
            message: "Transaction Fetched Successfully",
            transaction
        });
    }
)

export const duplicateTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const transactionId = transactionIdSchema.parse(req.params.id);

        const transaction = await duplicateTransactionService(
            userId, 
            transactionId
        );

        return res.status(HTTPSTATUS.OK).json({
            message: "Transaction Duplicated Successfully",
            transaction
        });
    }
)

export const updateTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const transactionId = transactionIdSchema.parse(req.params.id);
        const body = updateTransactionSchema.parse(req.body);

        await updateTransactionService(userId, transactionId, body);

        return res.status(HTTPSTATUS.OK).json({
            message: "Transaction Updated Successfully",
        });
    }
)

export const deleteTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const transactionId = transactionIdSchema.parse(req.params.id);

        await deleteTransactionService(userId, transactionId);

        return res.status(HTTPSTATUS.OK).json({
            message: "Transaction Deleted Successfully",
        });
    }
)

export const bulkDeleteTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const { transactionIds } = bulkDeleteTransactionSchema.parse(req.body);

        const result = await bulkDeleteTransactionService(userId, transactionIds);

        return res.status(HTTPSTATUS.OK).json({
            message: "Transactions Deleted Successfully",
            ...result
        });
    }
)

export const bulkTransactionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const { transactions } = bulkTransactionSchema.parse(req.body);

        const result = await bulkTransactionService(userId, transactions);

        return res.status(HTTPSTATUS.OK).json({
            message: "Bulk Transactions Created Successfully",
            ...result
        });
    }
)

export const scanReceiptController = asyncHandler(
    async (req: Request, res: Response) => {
        const file = req?.file;

        const result = await scanReceiptService(file);

        return res.status(HTTPSTATUS.OK).json({
            message: "Receipt Scanned Successfully",
            data: result
        });
    }
)