import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { AppError } from "../utils/appError.js";
import { serializeCategory } from "../utils/serializers.js";

export const listCategories = async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: {
      userId: req.auth!.sub
    },
    orderBy: [
      {
        type: "asc"
      },
      {
        name: "asc"
      }
    ]
  });

  res.json({
    data: categories.map(serializeCategory)
  });
};

export const createCategory = async (req: Request, res: Response) => {
  const category = await prisma.category.create({
    data: {
      userId: req.auth!.sub,
      name: req.body.name,
      type: req.body.type,
      isAiSuggested: req.body.isAiSuggested ?? false
    }
  });

  res.status(201).json({
    data: serializeCategory(category)
  });
};

export const updateCategory = async (req: Request, res: Response) => {
  const categoryId = String(req.params.id);
  const existing = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId: req.auth!.sub
    }
  });

  if (!existing) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  const category = await prisma.category.update({
    where: {
      id: existing.id
    },
    data: {
      name: req.body.name,
      type: req.body.type,
      isAiSuggested: req.body.isAiSuggested ?? existing.isAiSuggested
    }
  });

  res.json({
    data: serializeCategory(category)
  });
};

export const deleteCategory = async (req: Request, res: Response) => {
  const categoryId = String(req.params.id);
  const existing = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId: req.auth!.sub
    }
  });

  if (!existing) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  await prisma.category.delete({
    where: {
      id: existing.id
    }
  });

  res.json({
    success: true
  });
};
