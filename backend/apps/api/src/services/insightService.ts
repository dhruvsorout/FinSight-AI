import { prisma } from "./prisma.js";
import type { InsightRequest } from "../types/ai.js";

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const startOfWeek = (date: Date) => {
  const copy = startOfDay(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy;
};

export const buildInsightPayload = async (userId: string, period: "weekly" | "monthly") => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (period === "weekly" ? 7 : 30));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: start,
        lte: now
      }
    },
    include: {
      category: true
    },
    orderBy: {
      date: "asc"
    }
  });

  const income = transactions
    .filter((transaction: any) => Number(transaction.amount) > 0)
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0);
  const expense = transactions
    .filter((transaction: any) => Number(transaction.amount) < 0)
    .reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount)), 0);

  const categoryMap = new Map<string, { total: number; transactionCount: number }>();
  const weeklyMap = new Map<string, { totalIncome: number; totalExpense: number }>();

  for (const transaction of transactions) {
    const categoryName = transaction.category?.name ?? "Uncategorized";
    const currentCategory = categoryMap.get(categoryName) ?? { total: 0, transactionCount: 0 };
    currentCategory.total += Math.abs(Number(transaction.amount));
    currentCategory.transactionCount += 1;
    categoryMap.set(categoryName, currentCategory);

    const weekKey = startOfWeek(transaction.date).toISOString();
    const currentWeek = weeklyMap.get(weekKey) ?? { totalIncome: 0, totalExpense: 0 };

    if (Number(transaction.amount) >= 0) {
      currentWeek.totalIncome += Number(transaction.amount);
    } else {
      currentWeek.totalExpense += Math.abs(Number(transaction.amount));
    }

    weeklyMap.set(weekKey, currentWeek);
  }

  const payload: InsightRequest = {
    period,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString()
    },
    totals: {
      income,
      expense,
      net: income - expense
    },
    categorySummaries: [...categoryMap.entries()].map(([categoryName, value]) => ({
      categoryName,
      total: Number(value.total.toFixed(2)),
      transactionCount: value.transactionCount
    })),
    weeklySummaries: [...weeklyMap.entries()].map(([weekStart, value]) => ({
      weekStart,
      totalIncome: Number(value.totalIncome.toFixed(2)),
      totalExpense: Number(value.totalExpense.toFixed(2)),
      net: Number((value.totalIncome - value.totalExpense).toFixed(2))
    }))
  };

  return payload;
};
