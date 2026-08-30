import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { AppError } from "../utils/appError.js";

const assertAccountOwnership = async (
  tx: Prisma.TransactionClient,
  userId: string,
  accountId: string
) => {
  const account = await tx.account.findFirst({
    where: {
      id: accountId,
      userId
    }
  });

  if (!account) {
    throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }

  return account;
};

const assertCategoryOwnership = async (
  tx: Prisma.TransactionClient,
  userId: string,
  categoryId: string | null | undefined
) => {
  if (!categoryId) {
    return null;
  }

  const category = await tx.category.findFirst({
    where: {
      id: categoryId,
      userId
    }
  });

  if (!category) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  return category;
};

export const createTransactionWithBalanceUpdate = async (input: {
  userId: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  description: string;
  date: Date;
  source?: "manual" | "csv_import";
}) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await assertAccountOwnership(tx, input.userId, input.accountId);
    await assertCategoryOwnership(tx, input.userId, input.categoryId);

    const transaction = await tx.transaction.create({
      data: {
        userId: input.userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        amount: input.amount,
        description: input.description,
        date: input.date,
        source: input.source ?? "manual"
      },
      include: {
        account: true,
        category: true
      }
    });

    await tx.account.update({
      where: {
        id: input.accountId
      },
      data: {
        balance: {
          increment: input.amount
        }
      }
    });

    return transaction;
  });

export const updateTransactionWithBalanceUpdate = async (
  userId: string,
  transactionId: string,
  input: {
    accountId: string;
    categoryId?: string | null;
    amount: number;
    description: string;
    date: Date;
    source?: "manual" | "csv_import";
  }
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.transaction.findFirst({
      where: {
        id: transactionId,
        userId
      }
    });

    if (!existing) {
      throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
    }

    await assertAccountOwnership(tx, userId, input.accountId);
    await assertCategoryOwnership(tx, userId, input.categoryId);

    if (existing.accountId === input.accountId) {
      const delta = input.amount - Number(existing.amount);

      await tx.account.update({
        where: {
          id: input.accountId
        },
        data: {
          balance: {
            increment: delta
          }
        }
      });
    } else {
      await tx.account.update({
        where: {
          id: existing.accountId
        },
        data: {
          balance: {
            decrement: Number(existing.amount)
          }
        }
      });

      await tx.account.update({
        where: {
          id: input.accountId
        },
        data: {
          balance: {
            increment: input.amount
          }
        }
      });
    }

    return tx.transaction.update({
      where: {
        id: transactionId
      },
      data: {
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        amount: input.amount,
        description: input.description,
        date: input.date,
        source: input.source ?? existing.source
      },
      include: {
        account: true,
        category: true
      }
    });
  });

export const deleteTransactionWithBalanceUpdate = async (userId: string, transactionId: string) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.transaction.findFirst({
      where: {
        id: transactionId,
        userId
      },
      include: {
        category: true,
        account: true
      }
    });

    if (!existing) {
      throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
    }

    await tx.account.update({
      where: {
        id: existing.accountId
      },
      data: {
        balance: {
          decrement: Number(existing.amount)
        }
      }
    });

    await tx.transaction.delete({
      where: {
        id: transactionId
      }
    });

    return existing;
  });
