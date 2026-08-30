import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

export const validate =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;

    next();
  };

