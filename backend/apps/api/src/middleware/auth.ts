import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/appError.js";

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "A bearer access token is required."));
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== "access") {
      throw new AppError(401, "INVALID_TOKEN", "Access token is invalid.");
    }

    req.auth = payload;
    return next();
  } catch (error) {
    return next(new AppError(401, "INVALID_TOKEN", "Access token is invalid.", error));
  }
};

