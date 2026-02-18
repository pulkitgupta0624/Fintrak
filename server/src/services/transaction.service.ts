import TransactionModel, {
    TransactionTypeEnum
} from "../models/transaction.model.ts";
import { calculateNextOccurrence } from "../utils/helper.ts";
import {
    CreateTransactionType,
    UpdateTransactionType
} from "../validators/transaction.validator.ts";
import axios from "axios";
import { BadRequestException, NotFoundException } from "../utils/app-error.ts";
import { genAI, genAIModel } from "../config/google-ai.ts";
import { receiptPrompt } from "../utils/prompt.ts";
import { createPartFromBase64, createUserContent } from "@google/genai";
import { uploadToCloudinary } from "../config/cloudinary.config.ts";

export const createTransactionService = async (
    body: CreateTransactionType,
    userId: string
) => {
    let nextRecurringDate: Date | undefined;
    const currentDate = new Date();

    if (body.isRecurring && body.recurringInterval) {
        const calulatedDate = calculateNextOccurrence(
            body.date,
            body.recurringInterval
        );

        nextRecurringDate =
            calulatedDate < currentDate
                ? calculateNextOccurrence(currentDate, body.recurringInterval)
                : calulatedDate;
    }

    const transaction = await TransactionModel.create({
        ...body,
        userId,
        category: body.category,
        amount: Number(body.amount),
        isRecurring: body.isRecurring || false,
        recurringInterval: body.recurringInterval || null,
        nextRecurringDate,
        lastProcessed: null,
    });

    return transaction;
};

export const getAllTransactionService = async (
    userId: string,
    filters: {
        keyword?: string;
        type?: keyof typeof TransactionTypeEnum;
        recurringStatus?: "RECURRING" | "NON_RECURRING";
    },
    pagination: {
        pageSize: number;
        pageNumber: number;
    }
) => {
    const { keyword, type, recurringStatus } = filters;

    const filterCondition: Record<string, any> = {
        userId,
    };

    if (keyword) {
        filterCondition.$or = [
            { title: { $regex: keyword, $options: "i" } },
            { category: { $regex: keyword, $options: "i" } },
        ];
    }

    if (type) {
        filterCondition.type = type;
    }

    if (recurringStatus) {
        if (recurringStatus === "RECURRING") {
            filterCondition.isRecurring = true;
        } else if (recurringStatus === "NON_RECURRING") {
            filterCondition.isRecurring = false;
        }
    }

    const { pageSize, pageNumber } = pagination;
    const skip = (pageNumber - 1) * pageSize;

    const [transactions, totalCount] = await Promise.all([
        TransactionModel.find(filterCondition)
            .skip(skip)
            .limit(pageSize)
            .sort({ date: -1 }),
        TransactionModel.countDocuments(filterCondition),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        transactions,
        pagination: {
            pageSize,
            pageNumber,
            totalCount,
            totalPages,
            skip,
        }
    };
}

export const getTransactionByIdService = async (
    userId: string,
    transactionId: string
) => {
    const transaction = await TransactionModel.findOne({
        _id: transactionId,
        userId
    });
    if (!transaction) throw new Error("Transaction not found");

    return transaction
}

export const duplicateTransactionService = async (
    userId: string,
    transactionId: string
) => {
    const transaction = await TransactionModel.findOne({
        _id: transactionId,
        userId
    });
    if (!transaction) throw new Error("Transaction not found");

    const duplicated = await TransactionModel.create({
        ...transaction.toObject(),
        _id: undefined,
        title: `Duplicate - ${transaction.title}`,
        description: transaction.description
            ? `${transaction.description} - Duplicated`
            : "Duplicated Transaction",
        isRecurring: false,
        recurringInterval: undefined,
        nextRecurringDate: undefined,
        createdAt: undefined,
        updatedAt: undefined,
    })

    return duplicated
}

export const updateTransactionService = async (
    userId: string,
    transactionId: string,
    body: UpdateTransactionType
) => {
    const existingTransaction = await TransactionModel.findOne({
        _id: transactionId,
        userId
    });
    if (!existingTransaction)
        throw new Error("Transaction not found");

    const now = new Date();
    const isRecurring = body.isRecurring ?? existingTransaction.isRecurring;

    const date =
        body.date !== undefined ? new Date(body.date) : existingTransaction.date;

    const recurringInterval =
        body.recurringInterval || existingTransaction.recurringInterval;

    let nextRecurringDate: Date | undefined;

    if (isRecurring && recurringInterval) {
        const calulatedDate = calculateNextOccurrence(date, recurringInterval);

        nextRecurringDate =
            calulatedDate < now
                ? calculateNextOccurrence(now, recurringInterval)
                : calulatedDate;
    }

    existingTransaction.set({
        ...(body.title && { title: body.title }),
        ...(body.description && { description: body.description }),
        ...(body.category && { category: body.category }),
        ...(body.type && { type: body.type }),
        ...(body.paymentMethod) && { paymentMethod: body.paymentMethod },
        ...(body.amount && { amount: Number(body.amount) }),
        date,
        isRecurring,
        recurringInterval,
        nextRecurringDate,
    });

    await existingTransaction.save();

    return;
}

export const deleteTransactionService = async (
    userId: string,
    transactionId: string
) => {
    const transaction = await TransactionModel.findByIdAndDelete({
        _id: transactionId,
        userId
    });
    if (!transaction) throw new Error("Transaction not found");

    return transaction
}

export const bulkDeleteTransactionService = async (
    userId: string,
    transactionIds: string[]
) => {
    const result = await TransactionModel.deleteMany({
        _id: { $in: transactionIds },
        userId,
    });

    if (result.deletedCount === 0)
        throw new Error("Transaction not found");

    return {
        success: true,
        deletedCount: result.deletedCount
    }
}

export const bulkTransactionService = async (
    userId: string,
    transactions: CreateTransactionType[]
) => {
    try {
        const bulkOps = transactions.map((tx) => ({
            insertOne: {
                document: {
                    ...tx,
                    userId,
                    isRecurring: false,
                    nextRecurringDate: null,
                    recurringInterval: null,
                    lastProcesses: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            }
        }))

        const result = await TransactionModel.bulkWrite(bulkOps, {
            ordered: true,
        });

        return {
            insertedCount: result.insertedCount,
            success: true
        };
    } catch (error) {
        throw error;
    }
}

export const scanReceiptService = async (
  file: Express.Multer.File | undefined
) => {
  if (!file) throw new BadRequestException("File not found");

  try {
    // Convert the in‑memory buffer directly to base64
    const base64String = file.buffer.toString("base64");

    if (!base64String) throw new BadRequestException("Could not process file");

    const result = await genAI.models.generateContent({
      model: genAIModel,
      contents: [
        createUserContent([
          receiptPrompt,
          createPartFromBase64(base64String, file.mimetype),
        ])
      ],
      config: {
        temperature: 0,
        topP: 1,
        responseMimeType: "application/json"
      }
    });

    const response = result.text;
    const cleanedText = response?.replace(/```(?:json)?\n?/g, "").trim();

    if (!cleanedText) {
      return { error: "Could not read receipt" };
    }

    const data = JSON.parse(cleanedText);

    if (!data.amount || !data.date) {
      return { error: "Receipt missing required information" };
    }

    const receiptUrl = await uploadToCloudinary(file.buffer);

    return {
      title: data.title || "Receipt",
      amount: data.amount,
      date: data.date,
      describetion: data.description,
      category: data.category,
      paymentMethod: data.paymentMethod,
      type: data.type,
      receiptUrl
    };
  } catch (error) {
    // Optional: log error for debugging
    console.error("Receipt scanning error:", error);
    return { error: "Receipt scanning service unavailable" };
  }
};