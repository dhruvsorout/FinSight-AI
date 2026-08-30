import { decimalToNumber } from "./serialization.js";

type AccountLike = Record<string, unknown> & {
  balance: number | { toNumber?: () => number; toString: () => string };
};

type CategoryLike = Record<string, unknown>;

type TransactionLike = Record<string, unknown> & {
  amount: number | { toNumber?: () => number; toString: () => string };
  aiConfidence?: number | { toNumber?: () => number; toString: () => string } | null;
  date: Date;
  category?: { id: string; name: string; type: string } | null;
  account?: { id: string; name: string; type: string } | null;
};

export const serializeAccount = (account: AccountLike) => ({
  ...account,
  balance: decimalToNumber(account.balance)
});

export const serializeCategory = (category: CategoryLike) => category;

export const serializeTransaction = (transaction: TransactionLike) => ({
  ...transaction,
  amount: decimalToNumber(transaction.amount),
  aiConfidence: decimalToNumber(transaction.aiConfidence),
  date: transaction.date.toISOString(),
  category: transaction.category ?? null,
  account: transaction.account ?? null
});
