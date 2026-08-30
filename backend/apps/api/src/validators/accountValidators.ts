import { z } from "zod";

const accountBodySchema = z.object({
  name: z.string().min(2).max(60),
  type: z.enum(["bank", "cash", "card", "investment"]),
  balance: z.coerce.number().finite()
});

export const accountCreateSchema = z.object({
  body: accountBodySchema,
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const accountUpdateSchema = z.object({
  body: accountBodySchema,
  query: z.object({}).default({}),
  params: z.object({
    id: z.string().min(1)
  })
});

export const accountIdParamSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({
    id: z.string().min(1)
  })
});

