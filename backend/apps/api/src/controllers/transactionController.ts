import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import { prisma } from "../services/prisma.js";
import {
  createTransactionWithBalanceUpdate,
  deleteTransactionWithBalanceUpdate,
  updateTransactionWithBalanceUpdate
} from "../services/transactionService.js";
import { AppError } from "../utils/appError.js";
import { serializeTransaction } from "../utils/serializers.js";
import { importTransactionsSchema } from "../validators/transactionValidators.js";
import { aiClient } from "../services/aiClient.js";
import { ensureCategoryForUser, getUserCategoriesForAi } from "../services/categoryService.js";
import {
  fallbackCategorizeTransaction
} from "../services/fallbackAi.js";

export const listTransactions = async (req: Request, res: Response) => {
  const { startDate, endDate, categoryId, accountId, page = 1, pageSize = 20 } = req.query as unknown as {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    accountId?: string;
    page: number;
    pageSize: number;
  };

  const where = {
    userId: req.auth!.sub,
    ...(categoryId ? { categoryId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {})
          }
        }
      : {})
  };

  const [total, transactions] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: {
        account: true,
        category: true
      },
      orderBy: {
        date: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  res.json({
    data: transactions.map(serializeTransaction),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
};

export const createTransaction = async (req: Request, res: Response) => {
  const transaction = await createTransactionWithBalanceUpdate({
    userId: req.auth!.sub,
    accountId: req.body.accountId,
    categoryId: req.body.categoryId ?? null,
    amount: req.body.amount,
    description: req.body.description,
    date: new Date(req.body.date),
    source: req.body.source
  });

  res.status(201).json({
    data: serializeTransaction(transaction)
  });
};

export const updateTransaction = async (req: Request, res: Response) => {
  const transaction = await updateTransactionWithBalanceUpdate(req.auth!.sub, String(req.params.id), {
    accountId: req.body.accountId,
    categoryId: req.body.categoryId ?? null,
    amount: req.body.amount,
    description: req.body.description,
    date: new Date(req.body.date),
    source: req.body.source
  });

  res.json({
    data: serializeTransaction(transaction)
  });
};

export const deleteTransaction = async (req: Request, res: Response) => {
  const deleted = await deleteTransactionWithBalanceUpdate(req.auth!.sub, String(req.params.id));

  res.json({
    success: true,
    data: serializeTransaction(deleted)
  });
};

export const importTransactions = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(400, "CSV_REQUIRED", "Attach a CSV file under the field name `file`.");
  }

  const parsedBody = importTransactionsSchema.parse({
    body: req.body,
    query: req.query,
    params: req.params
  }).body;

  const account = await prisma.account.findFirst({
    where: {
      id: parsedBody.accountId,
      userId: req.auth!.sub
    }
  });

  if (!account) {
    throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }

  const rows = parse(req.file.buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  const validRows: Array<{
    userId: string;
    accountId: string;
    categoryId: string | null;
    amount: number;
    description: string;
    date: Date;
    source: "csv_import";
  }> = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const dateValue = row.date ?? row.Date;
    const description = row.description ?? row.Description;
    const amountValue = row.amount ?? row.Amount;
    const amount = Number(amountValue);
    const parsedDate = new Date(dateValue);

    if (!dateValue || Number.isNaN(parsedDate.getTime())) {
      errors.push(`Row ${index + 2}: invalid date.`);
      return;
    }

    if (!description) {
      errors.push(`Row ${index + 2}: description is required.`);
      return;
    }

    if (!Number.isFinite(amount)) {
      errors.push(`Row ${index + 2}: invalid amount.`);
      return;
    }

    validRows.push({
      userId: req.auth!.sub,
      accountId: parsedBody.accountId,
      categoryId: parsedBody.categoryId ?? null,
      amount,
      description,
      date: parsedDate,
      source: "csv_import"
    });
  });

  if (validRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.createMany({
        data: validRows
      });

      await tx.account.update({
        where: {
          id: parsedBody.accountId
        },
        data: {
          balance: {
            increment: validRows.reduce((sum, row) => sum + row.amount, 0)
          }
        }
      });
    });
  }

  res.status(201).json({
    imported: validRows.length,
    skipped: errors.length,
    errors
  });
};

const categorizeOneTransaction = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId
    }
  });

  if (!transaction) {
    throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
  }

  const categories = await getUserCategoriesForAi(userId);
  let aiResult;

  try {
    aiResult = await aiClient.categorize({
      description: transaction.description,
      amount: Number(transaction.amount),
      existingCategories: categories
    });
  } catch {
    aiResult = fallbackCategorizeTransaction({
      description: transaction.description,
      amount: Number(transaction.amount),
      existingCategories: categories
    });
  }

  const category = await ensureCategoryForUser(
    userId,
    aiResult.suggestedCategoryName,
    Number(transaction.amount)
  );

  const updated = await prisma.transaction.update({
    where: {
      id: transaction.id
    },
    data: {
      categoryId: category.id,
      aiConfidence: aiResult.confidence
    },
    include: {
      account: true,
      category: true
    }
  });

  return {
    transaction: updated,
    aiResult
  };
};

export const categorizeTransaction = async (req: Request, res: Response) => {
  const result = await categorizeOneTransaction(req.auth!.sub, String(req.params.id));

  res.json({
    data: serializeTransaction(result.transaction),
    categorization: result.aiResult
  });
};

export const categorizeUncategorizedTransactions = async (req: Request, res: Response) => {
  const limit = req.body.limit ?? 25;
  const uncategorized = await prisma.transaction.findMany({
    where: {
      userId: req.auth!.sub,
      categoryId: null
    },
    orderBy: {
      date: "desc"
    },
    take: limit
  });

  const results = [];

  for (const transaction of uncategorized) {
    const categorized = await categorizeOneTransaction(req.auth!.sub, transaction.id);
    results.push({
      transactionId: transaction.id,
      category: categorized.aiResult.suggestedCategoryName,
      confidence: categorized.aiResult.confidence,
      provider: categorized.aiResult.provider
    });
  }

  res.json({
    processed: uncategorized.length,
    results
  });
};
