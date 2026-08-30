import { z } from "zod";
import { env } from "../config/env.js";
import type {
  CategorizeTransactionRequest,
  CategorizeTransactionResponse,
  InsightRequest,
  InsightResponse,
  StructuredQueryRequest,
  StructuredQueryResponse
} from "../types/ai.js";
import { AppError } from "../utils/appError.js";

const categorizeResponseSchema = z.object({
  suggestedCategoryName: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  provider: z.enum(["gemini", "fallback"])
});

const insightResponseSchema = z.object({
  summary: z.string().min(1),
  suggestions: z.array(z.string()).min(1).max(5),
  anomalies: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      severity: z.enum(["low", "medium", "high"])
    })
  ),
  provider: z.enum(["gemini", "fallback"])
});

const queryResponseSchema = z.object({
  query: z.object({
    aggregation: z.enum(["sum", "count", "average", "list"]),
    metric: z.literal("amount"),
    filters: z.array(
      z.object({
        field: z.enum(["categoryName", "accountName", "transactionType", "date"]),
        operator: z.enum(["equals", "between"]),
        value: z.union([z.string(), z.tuple([z.string(), z.string()])])
      })
    ),
    limit: z.number().int().positive().optional(),
    answerLabel: z.string(),
    groupBy: z.enum(["categoryName"]).optional(),
    rank: z.enum(["top", "bottom"]).optional(),
    rankLimit: z.number().int().positive().optional()
  }),
  provider: z.enum(["gemini", "fallback"])
});

const requestWithRetry = async <T>(path: string, payload: unknown, schema: z.ZodSchema<T>) => {
  const url = new URL(path, env.AI_SERVICE_URL).toString();

  let lastError: unknown;

  for (let attempt = 0; attempt <= env.AI_SERVICE_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const message = await response.text();
        throw new AppError(
          response.status,
          "AI_SERVICE_ERROR",
          `AI service request failed with status ${response.status}.`,
          message
        );
      }

      const json = (await response.json()) as unknown;
      return schema.parse(json);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
  }

  throw new AppError(503, "AI_SERVICE_UNAVAILABLE", "AI service is unavailable.", lastError);
};

export const aiClient = {
  categorize: (payload: CategorizeTransactionRequest): Promise<CategorizeTransactionResponse> =>
    requestWithRetry("/ai/categorize", payload, categorizeResponseSchema),
  insights: (payload: InsightRequest): Promise<InsightResponse> =>
    requestWithRetry("/ai/insights", payload, insightResponseSchema),
  query: (payload: StructuredQueryRequest): Promise<StructuredQueryResponse> =>
    requestWithRetry("/ai/query", payload, queryResponseSchema)
};

