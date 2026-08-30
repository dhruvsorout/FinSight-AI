import { prisma } from "./prisma.js";
import type { StructuredQueryFilter, StructuredQueryResponse, StructuredQuerySpec } from "../types/ai.js";

const buildWhereClause = async (
  userId: string,
  filters: StructuredQueryFilter[],
  skipCategoryFilter = false
): Promise<Record<string, unknown>> => {
  const where: Record<string, unknown> = {
    userId
  };

  for (const filter of filters) {
    if (filter.field === "date" && filter.operator === "between" && Array.isArray(filter.value)) {
      where.date = {
        gte: new Date(filter.value[0]),
        lte: new Date(filter.value[1])
      };
    }

    if (!skipCategoryFilter && filter.field === "categoryName" && filter.operator === "equals" && typeof filter.value === "string") {
      where.category = {
        name: {
          equals: filter.value,
          mode: "insensitive"
        }
      };
    }

    if (filter.field === "accountName" && filter.operator === "equals" && typeof filter.value === "string") {
      where.account = {
        name: {
          equals: filter.value,
          mode: "insensitive"
        }
      };
    }

    if (filter.field === "transactionType" && filter.operator === "equals" && typeof filter.value === "string") {
      if (filter.value === "expense") {
        where.amount = {
          lt: 0
        };
      }

      if (filter.value === "income") {
        where.amount = {
          gt: 0
        };
      }
    }
  }

  return where;
};

// ---------------------------------------------------------------------------
// GroupBy + Rank execution
// ---------------------------------------------------------------------------
export interface GroupedQueryResult {
  categoryName: string;
  total: number;
}

const executeGroupByQuery = async (
  userId: string,
  spec: StructuredQuerySpec
): Promise<{ value: number; records: unknown[]; groupedResults: GroupedQueryResult[] }> => {
  // Build WHERE clause but skip any categoryName filter since we're grouping by it
  const where = await buildWhereClause(userId, spec.filters, true);

  const orderDirection = spec.rank === "bottom" ? "asc" : "desc";
  const takeCount = spec.rankLimit ?? 1;

  // Group by categoryId and sum amounts
  const grouped = await (prisma.transaction as any).groupBy({
    by: ["categoryId"],
    where,
    _sum: { amount: true },
    orderBy: { _sum: { amount: orderDirection } },
    take: takeCount
  });

  if (!grouped.length) {
    return { value: 0, records: [], groupedResults: [] };
  }

  // Resolve category names for the returned categoryIds
  const categoryIds = grouped
    .map((g: any) => g.categoryId)
    .filter((id: any): id is string => id !== null && id !== undefined);

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true }
  });

  const categoryMap = new Map<string, string>(
    categories.map((c: { id: string; name: string }) => [c.id, c.name])
  );

  const groupedResults: GroupedQueryResult[] = grouped.map((g: any) => ({
    categoryName: categoryMap.get(g.categoryId) ?? "Unknown",
    total: Number(g._sum.amount ?? 0)
  }));

  const topTotal = Number(grouped[0]._sum?.amount ?? 0);

  return { value: topTotal, records: [], groupedResults };
};

// ---------------------------------------------------------------------------
// Main query executor
// ---------------------------------------------------------------------------
export const executeStructuredQuery = async (userId: string, spec: StructuredQuerySpec) => {
  // GroupBy path — must be checked before the flat aggregation paths
  if (spec.groupBy === "categoryName") {
    return executeGroupByQuery(userId, spec);
  }

  const where = await buildWhereClause(userId, spec.filters);

  if (spec.aggregation === "count") {
    const count = await prisma.transaction.count({ where: where as any });
    return {
      value: count,
      records: [],
      groupedResults: []
    };
  }

  if (spec.aggregation === "list") {
    const records = await prisma.transaction.findMany({
      where: where as any,
      take: spec.limit ?? 10,
      orderBy: {
        date: "desc"
      },
      include: {
        category: true,
        account: true
      }
    });

    return {
      value: records.length,
      records: records.map((record: any) => ({
        id: record.id,
        amount: Number(record.amount),
        description: record.description,
        date: record.date.toISOString(),
        category: record.category?.name ?? null,
        account: record.account.name
      })),
      groupedResults: []
    };
  }

  const aggregate = await prisma.transaction.aggregate({
    where: where as any,
    _avg: {
      amount: true
    },
    _sum: {
      amount: true
    }
  });

  if (spec.aggregation === "average") {
    return {
      value: Number(aggregate._avg.amount ?? 0),
      records: [],
      groupedResults: []
    };
  }

  return {
    value: Number(aggregate._sum.amount ?? 0),
    records: [],
    groupedResults: []
  };
};

// ---------------------------------------------------------------------------
// Answer formatter
// ---------------------------------------------------------------------------
export const formatGroundedAnswer = (
  question: string,
  spec: StructuredQueryResponse["query"],
  result: { value: number; records: unknown[]; groupedResults?: GroupedQueryResult[] }
) => {
  // GroupBy + rank answer
  if (spec.groupBy === "categoryName" && result.groupedResults && result.groupedResults.length > 0) {
    const top = result.groupedResults[0];
    const absTotal = Math.abs(top.total);
    const direction = spec.rank === "bottom" ? "least" : "most";

    if (result.groupedResults.length === 1) {
      return `You spent the ${direction} on **${top.categoryName}**, totaling **$${absTotal.toFixed(2)}**.`;
    }

    const list = result.groupedResults
      .map((g, i) => `${i + 1}. ${g.categoryName} — $${Math.abs(g.total).toFixed(2)}`)
      .join("\n");
    return `Here are your ${spec.rank === "bottom" ? "lowest" : "top"} spending categories:\n${list}`;
  }

  if (spec.aggregation === "count") {
    return `For "${question}", I found ${result.value} matching transactions.`;
  }

  if (spec.aggregation === "average") {
    return `For "${question}", the average amount across matching transactions is ${result.value.toFixed(2)}.`;
  }

  if (spec.aggregation === "list") {
    return `For "${question}", I found ${result.value} matching transactions and returned the most recent ${result.records.length}.`;
  }

  return `For "${question}", the grounded total from your real transaction data is ${result.value.toFixed(2)}.`;
};
