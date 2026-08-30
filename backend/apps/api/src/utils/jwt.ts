import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "../types/jwt.js";

export const signAccessToken = (payload: Omit<JwtPayload, "type">) =>
  jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  });

export const signRefreshToken = (payload: Omit<JwtPayload, "type">) =>
  jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
  });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
