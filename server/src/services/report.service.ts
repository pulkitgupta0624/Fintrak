import ReportSettingModel from "../models/report-setting.model.ts";
import ReportModel from "../models/report.model.ts";
import { UpdateReportSettingType } from "../validators/report.validator.ts";
import mongoose from "mongoose";
import TransactionModel, {
    TransactionTypeEnum
} from "../models/transaction.model.ts";
import { NotFoundException } from "../utils/app-error.ts";
import { calculateNextReportDate } from "../utils/helper.ts";
import { convertToDollarUnit } from "../utils/format-currency.ts";
import { format } from "date-fns";
import { genAI, genAIModel } from "../config/google-ai.ts";
import { createUserContent } from "@google/genai";
import { reportInsightPrompt } from "../utils/prompt.ts";

export const getAllReportsService = async (
    userId: string,
    pagination: {
        pageSize: number;
        pageNumber: number;
    }
) => {
    const query: Record<string, any> = { userId };

    const { pageSize, pageNumber } = pagination;
    const skip = (pageNumber - 1) * pageSize;

    const [reports, totalCount] = await Promise.all([
        ReportModel.find(query).skip(skip).limit(pageSize).sort({ sentDate: -1 }),
        ReportModel.countDocuments(query)
    ])

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        reports,
        pagination: {
            pageSize,
            pageNumber,
            totalCount,
            totalPages,
            skip
        }
    }
}

export const updateReportSettingService = async (
    userId: string,
    body: UpdateReportSettingType
) => {
    const { isEnabled } = body;
    let nextReportDate: Date | null = null;

    const existingReportSetting = await ReportSettingModel.findOne({
        userId,
    })
    if (!existingReportSetting)
        throw new NotFoundException("Report setting not found");

    // const frequency = 
    //     existingReportSetting.frequency || ReportFrequencyEnum.MONTHLY 

    if (isEnabled) {
        const currentNextTeportDate = existingReportSetting.nextReportDate;
        const now = new Date();
        if (!currentNextTeportDate || currentNextTeportDate < now) {
            nextReportDate = calculateNextReportDate(
                existingReportSetting.lastSentDate
            );
        } else {
            nextReportDate = currentNextTeportDate;
        }
    }

    console.log(nextReportDate, "nextReportdate");

    existingReportSetting.set({
        ...body,
        nextReportDate,
    })

    await existingReportSetting.save();
}

export const generateReportService = async (
    userId: string,
    fromDate: Date,
    toDate: Date
) => {
    const results = await TransactionModel.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                date: { $gte: fromDate, $lte: toDate },
            },
        },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalIncome: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$type", TransactionTypeEnum.INCOME] },
                                        { $abs: "$amount" },
                                        0,
                                    ],
                                },
                            },

                            totalExpenses: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$type", TransactionTypeEnum.EXPENSE] },
                                        { $abs: "$amount" },
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ],

                categories: [
                    {
                        $match: { type: TransactionTypeEnum.EXPENSE },
                    },
                    {
                        $group: {
                            _id: "$category",
                            total: { $sum: { $abs: "$amount" } },
                        },
                    },
                    {
                        $sort: { total: -1 },
                    },
                    {
                        $limit: 5,
                    },
                ],
            },
        },
        {
            $project: {
                totalIncome: {
                    $arrayElemAt: ["$summary.totalIncome", 0],
                },
                totalExpenses: {
                    $arrayElemAt: ["$summary.totalExpenses", 0],
                },
                categories: 1,
            },
        },
    ]);

    if (
        !results?.length ||
        (results[0]?.totalIncome === 0 && results[0]?.totalExpenses === 0)
    )
        return null;

    const {
        totalIncome = 0,
        totalExpenses = 0,
        categories = [],
    } = results[0] || {};

    console.log(results[0], "results");

    const byCategory = categories.reduce(
        (acc: any, { _id, total }: any) => {
            acc[_id] = {
                amount: convertToDollarUnit(total),
                percentage:
                    totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
            };
            return acc;
        },
        {} as Record<string, { amount: number; percentage: number }>
    );

    const availableBalance = totalIncome - totalExpenses;
    const savingsRate = calculateSavingRate(totalIncome, totalExpenses);

    const periodLabel = `${format(fromDate, "MMMM d")} - ${format(toDate, "d, yyyy")}`;

    const insights = await generateInsightsAI({
        totalIncome,
        totalExpenses,
        availableBalance,
        savingsRate,
        categories: byCategory,
        periodLabel: periodLabel,
    });

    return {
        period: periodLabel,
        summary: {
            income: convertToDollarUnit(totalIncome),
            expenses: convertToDollarUnit(totalExpenses),
            balance: convertToDollarUnit(availableBalance),
            savingsRate: Number(savingsRate.toFixed(1)),
            topCategories: Object.entries(byCategory)?.map(([name, cat]: any) => ({
                name,
                amount: cat.amount,
                percent: cat.percentage,
            })),
        },
        insights,
    };
};

async function generateInsightsAI({
    totalIncome,
    totalExpenses,
    availableBalance,
    savingsRate,
    categories,
    periodLabel,
}: {
    totalIncome: number;
    totalExpenses: number;
    availableBalance: number;
    savingsRate: number;
    categories: Record<string, { amount: number; percentage: number }>;
    periodLabel: string;
}) {
    try {
        const prompt = reportInsightPrompt({
            totalIncome: convertToDollarUnit(totalIncome),
            totalExpenses: convertToDollarUnit(totalExpenses),
            availableBalance: convertToDollarUnit(availableBalance),
            savingsRate: Number(savingsRate.toFixed(1)),
            categories,
            periodLabel,
        });

        const result = await genAI.models.generateContent({
            model: genAIModel,
            contents: [createUserContent([prompt])],
            config: {
                responseMimeType: "application/json",
            }
        });

        const response = result.text;
        const cleanedText = response?.replace(/```(?:json)?\n?/g, "").trim();

        if (!cleanedText) return [];

        const data = JSON.parse(cleanedText);
        return data;
    } catch (error) {
        return [];
    }
}

function calculateSavingRate(totalIncome: number, totalExpenses: number) {
    if(totalIncome <= 0) return 0;
    const savingRate = ((totalIncome - totalExpenses) / totalIncome)*100;
    return parseFloat(savingRate.toFixed(2));
}
