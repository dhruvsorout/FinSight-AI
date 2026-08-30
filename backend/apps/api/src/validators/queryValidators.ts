import { z } from "zod";

export const naturalLanguageQuerySchema = z.object({
  body: z.object({
    question: z.string().min(5).max(300)
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

