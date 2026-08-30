import { z } from "zod";

const transactionBodySchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  amount: z.coerce.number().finite(),
  description: z.string().min(2).max(200),
  date: z.string().datetime(),
  source: z.enum(["manual", "csv_import"]).optional()
});

export const transactionCreateSchema = z.object({
  body: transactionBodySchema,
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const transactionUpdateSchema = z.object({
  body: transactionBodySchema,
  query: z.object({}).default({}),
  params: z.object({
    id: z.string().min(1)
  })
});

export const transactionIdParamSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({
    id: z.string().min(1)
  })
});

export const transactionFilterSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    categoryId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
  }),
  params: z.object({}).default({})
});

export const importTransactionsSchema = z.object({
  body: z.object({
    accountId: z.string().min(1),
    categoryId: z.string().min(1).optional()
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const bulkCategorizeSchema = z.object({
  body: z
    .object({
      limit: z.coerce.number().int().positive().max(100).default(25)
    })
    .default({ limit: 25 }),
  query: z.object({}).default({}),
  params: z.object({}).default({})
});
