export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: "income" | "expense";
  isAiSuggested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  description: string;
  date: string;
  source: string;
  aiConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
    type: string;
  } | null;
  account?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TransactionsResponse {
  data: Transaction[];
  pagination: Pagination;
}

export interface Anomaly {
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

export interface InsightsData {
  summary: string;
  suggestions: string[];
  anomalies: Anomaly[];
  provider: string;
}

export interface InsightsResponse {
  period: string;
  dateRange: { start: string; end: string };
  data: InsightsData;
  cached: boolean;
}

export interface QueryResponse {
  answer: string;
  provider: string;
  groundedQuery: {
    aggregation: string;
    metric: string;
    filters: Array<{ field: string; operator: string; value: unknown }>;
    answerLabel: string;
  };
  result: {
    value: number | null;
    records: Transaction[];
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

export interface CategorizationResult {
  data: Transaction;
  categorization: {
    suggestedCategoryName: string;
    confidence: number;
    provider: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
