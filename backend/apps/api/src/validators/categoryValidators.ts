import { z } from "zod";

const categoryBodySchema = z.object({
  name: z.string().min(2).max(60),
  type: z.enum(["income", "expense"]),
  isAiSuggested: z.boolean().optional()
});

export const categoryCreateSchema = z.object({
  body: categoryBodySchema,
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const categoryUpdateSchema = z.object({
  body: categoryBodySchema,
  query: z.object({}).default({}),
  params: z.object({
    id: z.string().min(1)
  })
});

export const categoryIdParamSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({
    id: z.string().min(1)
  })
});

