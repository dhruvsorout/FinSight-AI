import type {
  CategorizeTransactionRequest,
  CategorizeTransactionResponse,
  InsightRequest,
  InsightResponse,
  StructuredQueryResponse,
  StructuredQuerySpec
} from "../types/ai.js";

const categoryKeywordRules: Array<{ keywords: string[]; category: string }> = [
  { keywords: ["swiggy", "zomato", "ubereats", "restaurant", "cafe", "coffee"], category: "Food & Dining" },
  { keywords: ["grocery", "supermarket", "mart", "whole foods"], category: "Groceries" },
  { keywords: ["uber", "ola", "lyft", "metro", "fuel", "gas"], category: "Transportation" },
  { keywords: ["rent", "landlord"], category: "Rent" },
  { keywords: ["netflix", "spotify", "cinema", "movie"], category: "Entertainment" },
  { keywords: ["doctor", "pharmacy", "hospital"], category: "Healthcare" },
  { keywords: ["amazon", "flipkart", "myntra", "shopping"], category: "Shopping" },
  { keywords: ["salary", "payroll", "bonus"], category: "Salary" },
  { keywords: ["freelance", "invoice", "consulting"], category: "Freelance" }
];

export const fallbackCategorizeTransaction = (
  payload: CategorizeTransactionRequest
): CategorizeTransactionResponse => {
  const haystack = payload.description.toLowerCase();
  const matchedRule = categoryKeywordRules.find((rule) =>
    rule.keywords.some((keyword) => haystack.includes(keyword))
  );

  const fallbackCategory =
    matchedRule?.category ??
    (payload.amount >= 0 ? "Salary" : "Shopping");

  return {
    suggestedCategoryName: fallbackCategory,
    confidence: matchedRule ? 0.64 : 0.35,
    reasoning: matchedRule
      ? "Matched a keyword-based local fallback rule."
      : "Used transaction direction fallback because the AI service was unavailable.",
    provider: "fallback"
  };
};

export const fallbackInsights = (payload: InsightRequest): InsightResponse => {
  const topCategory = [...payload.categorySummaries].sort((a, b) => Math.abs(b.total) - Math.abs(a.total))[0];
  const anomaly = payload.weeklySummaries.find(
    (week) => Math.abs(week.totalExpense) > Math.max(Math.abs(payload.totals.expense) / 2, 1)
  );

  return {
    summary: `Net cash flow for the ${payload.period} window is ${payload.totals.net.toFixed(2)}. ${
      topCategory
        ? `Your largest category is ${topCategory.categoryName} at ${topCategory.total.toFixed(2)}.`
        : "There is not enough categorized activity yet for a category comparison."
    }`,
    suggestions: [
      "Review the highest-spend category and set a target budget for the next period.",
      "Tag uncategorized transactions so future insights become more accurate.",
      payload.totals.net < 0
        ? "Consider reducing discretionary expenses to bring net cash flow back above zero."
        : "Move part of the positive net cash flow into savings or investments."
    ],
    anomalies: anomaly
      ? [
          {
            label: "Expense spike",
            detail: `Week starting ${anomaly.weekStart} had unusually high expense activity.`,
            severity: "medium"
          }
        ]
      : [],
    provider: "fallback"
  };
};

const parseRelativeDateRange = (question: string): [string, string] | null => {
  const now = new Date();

  if (question.includes("last month")) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return [start.toISOString(), end.toISOString()];
  }

  if (question.includes("this month")) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return [start.toISOString(), now.toISOString()];
  }

  if (question.includes("last week")) {
    const end = new Date(now);
    end.setDate(now.getDate() - 7);
    return [end.toISOString(), now.toISOString()];
  }

  return null;
};

export const fallbackStructuredQuery = (question: string): StructuredQueryResponse => {
  const lowerQuestion = question.toLowerCase();
  const filters: StructuredQuerySpec["filters"] = [];
  const dateRange = parseRelativeDateRange(lowerQuestion);

  if (dateRange) {
    filters.push({
      field: "date",
      operator: "between",
      value: dateRange
    });
  }

  // Detect "group by category + rank" intent before flat filters
  const topKeywords = ["most", "biggest", "highest", "top spending", "top category", "top expense"];
  const bottomKeywords = ["least", "lowest", "smallest", "bottom spending", "bottom category"];
  const isTop = topKeywords.some((kw) => lowerQuestion.includes(kw));
  const isBottom = bottomKeywords.some((kw) => lowerQuestion.includes(kw));

  if (isTop || isBottom) {
    // Spending questions: default to expense filter
    if (
      lowerQuestion.includes("spend") ||
      lowerQuestion.includes("spent") ||
      lowerQuestion.includes("expense") ||
      isTop ||
      isBottom
    ) {
      filters.push({ field: "transactionType", operator: "equals", value: "expense" });
    }

    return {
      query: {
        aggregation: "sum",
        metric: "amount",
        filters,
        answerLabel: isTop ? "Top category by spending" : "Bottom category by spending",
        groupBy: "categoryName",
        rank: isTop ? "top" : "bottom",
        rankLimit: 1
      },
      provider: "fallback"
    };
  }

  if (lowerQuestion.includes("food")) {
    filters.push({
      field: "categoryName",
      operator: "equals",
      value: "Food & Dining"
    });
  }

  if (lowerQuestion.includes("grocery")) {
    filters.push({
      field: "categoryName",
      operator: "equals",
      value: "Groceries"
    });
  }

  if (lowerQuestion.includes("income") || lowerQuestion.includes("earned")) {
    filters.push({
      field: "transactionType",
      operator: "equals",
      value: "income"
    });
  }

  if (lowerQuestion.includes("spent") || lowerQuestion.includes("expense")) {
    filters.push({
      field: "transactionType",
      operator: "equals",
      value: "expense"
    });
  }

  const aggregation = lowerQuestion.includes("average")
    ? "average"
    : lowerQuestion.includes("list")
      ? "list"
      : lowerQuestion.includes("how many") || lowerQuestion.includes("count")
        ? "count"
        : "sum";

  return {
    query: {
      aggregation,
      metric: "amount",
      filters,
      limit: aggregation === "list" ? 10 : undefined,
      answerLabel: "Fallback parsed result"
    },
    provider: "fallback"
  };
};

