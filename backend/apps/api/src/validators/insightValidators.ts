import { z } from "zod";

export const insightQuerySchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    period: z.enum(["weekly", "monthly"]).default("monthly")
  }),
  params: z.object({}).default({})
});

