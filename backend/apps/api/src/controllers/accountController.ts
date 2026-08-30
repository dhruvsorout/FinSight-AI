import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { AppError } from "../utils/appError.js";
import { serializeAccount } from "../utils/serializers.js";

export const listAccounts = async (req: Request, res: Response) => {
  const accounts = await prisma.account.findMany({
    where: {
      userId: req.auth!.sub
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json({
    data: accounts.map(serializeAccount)
  });
};

export const createAccount = async (req: Request, res: Response) => {
  const account = await prisma.account.create({
    data: {
      userId: req.auth!.sub,
      name: req.body.name,
      type: req.body.type,
      balance: req.body.balance
    }
  });

  res.status(201).json({
    data: serializeAccount(account)
  });
};

export const updateAccount = async (req: Request, res: Response) => {
  const accountId = String(req.params.id);
  const existing = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: req.auth!.sub
    }
  });

  if (!existing) {
    throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }

  const account = await prisma.account.update({
    where: {
      id: existing.id
    },
    data: {
      name: req.body.name,
      type: req.body.type,
      balance: req.body.balance
    }
  });

  res.json({
    data: serializeAccount(account)
  });
};

export const deleteAccount = async (req: Request, res: Response) => {
  const accountId = String(req.params.id);
  const existing = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: req.auth!.sub
    }
  });

  if (!existing) {
    throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }

  const transactionCount = await prisma.transaction.count({
    where: {
      accountId: existing.id
    }
  });

  if (transactionCount > 0) {
    throw new AppError(
      409,
      "ACCOUNT_HAS_TRANSACTIONS",
      "Delete or move linked transactions before deleting this account."
    );
  }

  await prisma.account.delete({
    where: {
      id: existing.id
    }
  });

  res.json({
    success: true
  });
};
