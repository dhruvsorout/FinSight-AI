import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../services/prisma.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { AppError } from "../utils/appError.js";
import { env } from "../config/env.js";
import {
  issueAuthTokens,
  revokeRefreshToken,
  rotateRefreshToken
} from "../services/authTokens.js";
import { seedDefaultCategoriesForUser } from "../services/categoryService.js";

export const signup = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existingUser) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        name
      }
    });

    await seedDefaultCategoriesForUser(createdUser.id, tx);
    return createdUser;
  });

  const tokens = await issueAuthTokens(user, env.JWT_REFRESH_EXPIRES_IN);

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    },
    tokens
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const tokens = await issueAuthTokens(user, env.JWT_REFRESH_EXPIRES_IN);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    },
    tokens
  });
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const tokens = await rotateRefreshToken(refreshToken, env.JWT_REFRESH_EXPIRES_IN);

  res.json({ tokens });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await revokeRefreshToken(refreshToken);

  res.json({
    success: true
  });
};
