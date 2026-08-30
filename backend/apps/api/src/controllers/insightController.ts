import type { Request, Response } from "express";
import { insightCache } from "../cache/insightCache.js";
import { buildInsightPayload } from "../services/insightService.js";
import { aiClient } from "../services/aiClient.js";
import { fallbackInsights } from "../services/fallbackAi.js";

export const getInsights = async (req: Request, res: Response) => {
  const period = (req.query.period as "weekly" | "monthly") ?? "monthly";
  const cacheKey = `${req.auth!.sub}:${period}`;
  const cached = insightCache.get(cacheKey);

  if (cached) {
    return res.json({
      ...(cached as object),
      cached: true
    });
  }

  const payload = await buildInsightPayload(req.auth!.sub, period);

  let insights;
  try {
    insights = await aiClient.insights(payload);
  } catch {
    insights = fallbackInsights(payload);
  }

  const response = {
    period,
    dateRange: payload.dateRange,
    data: insights,
    cached: false
  };

  insightCache.set(cacheKey, response);
  return res.json(response);
};

