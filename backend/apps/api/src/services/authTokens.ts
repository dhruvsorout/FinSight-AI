import { prisma } from "./prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashOpaqueToken } from "../utils/opaqueToken.js";
import { AppError } from "../utils/appError.js";

const parseRefreshExpiry = (value: string) => {
  const match = value.match(/^(\d+)([dhm])$/);

  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const [, countString, unit] = match;
  const count = Number(countString);

  switch (unit) {
    case "d":
      return count * 24 * 60 * 60 * 1000;
    case "h":
      return count * 60 * 60 * 1000;
    case "m":
      return count * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
};

export const issueAuthTokens = async (
  user: { id: string; email: string },
  refreshExpiry: string
) => {
  const jti = globalThis.crypto.randomUUID();
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    jti
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashOpaqueToken(refreshToken),
      expiresAt: new Date(Date.now() + parseRefreshExpiry(refreshExpiry))
    }
  });

  return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (refreshToken: string, refreshExpiry: string) => {
  const payload = verifyRefreshToken(refreshToken);

  if (payload.type !== "refresh") {
    throw new AppError(401, "INVALID_TOKEN", "Refresh token is invalid.");
  }

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.sub,
      tokenHash: hashOpaqueToken(refreshToken),
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  });

  if (!tokenRecord) {
    throw new AppError(401, "INVALID_TOKEN", "Refresh token is invalid or expired.");
  }

  await prisma.refreshToken.update({
    where: {
      id: tokenRecord.id
    },
    data: {
      revokedAt: new Date()
    }
  });

  return issueAuthTokens(tokenRecord.user, refreshExpiry);
};

export const revokeRefreshToken = async (refreshToken: string) => {
  try {
    const payload = verifyRefreshToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: {
        userId: payload.sub,
        tokenHash: hashOpaqueToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  } catch {
    return;
  }
};
