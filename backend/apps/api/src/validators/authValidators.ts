import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    name: z.string().min(2).max(80)
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100)
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10)
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({})
});

export const logoutSchema = refreshSchema;

