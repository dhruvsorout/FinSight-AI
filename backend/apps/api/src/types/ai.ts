export interface CategorizeTransactionRequest {
  description: string;
  amount: number;
  existingCategories: Array<{
    name: string;
    type: "income" | "expense";
  }>;
}

export interface CategorizeTransactionResponse {
  suggestedCategoryName: string;
  confidence: number;
  reasoning?: string;
  provider: "gemini" | "fallback";
}

export interface CategorySummaryInput {
  categoryName: string;
  total: number;
  transactionCount: number;
}

export interface WeeklySummaryInput {
  weekStart: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface InsightAnomaly {
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

export interface InsightRequest {
  period: "weekly" | "monthly";
  dateRange: {
    start: string;
    end: string;
  };
  totals: {
    income: number;
    expense: number;
    net: number;
  };
  categorySummaries: CategorySummaryInput[];
  weeklySummaries: WeeklySummaryInput[];
}

export interface InsightResponse {
  summary: string;
  suggestions: string[];
  anomalies: InsightAnomaly[];
  provider: "gemini" | "fallback";
}

export interface QueryFieldDescriptor {
  field: string;
  description: string;
  operators: string[];
}

export interface StructuredQueryRequest {
  question: string;
  availableFields: QueryFieldDescriptor[];
  categories: Array<{
    name: string;
    type: "income" | "expense";
  }>;
}

export interface StructuredQueryFilter {
  field: "categoryName" | "accountName" | "transactionType" | "date";
  operator: "equals" | "between";
  value: string | [string, string];
}

export interface StructuredQuerySpec {
  aggregation: "sum" | "count" | "average" | "list";
  metric: "amount";
  filters: StructuredQueryFilter[];
  limit?: number;
  answerLabel: string;
  groupBy?: "categoryName";
  rank?: "top" | "bottom";
  rankLimit?: number;
}

export interface StructuredQueryResponse {
  query: StructuredQuerySpec;
  provider: "gemini" | "fallback";
}
