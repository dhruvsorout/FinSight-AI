import { prisma } from "./prisma.js";
import { DEFAULT_CATEGORIES } from "../utils/defaultCategories.js";

type CategoryWriter = {
  category: {
    createMany: typeof prisma.category.createMany;
  };
};

export const seedDefaultCategoriesForUser = async (userId: string, tx: CategoryWriter = prisma) => {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({
      userId,
      name: category.name,
      type: category.type,
      isAiSuggested: false
    })),
    skipDuplicates: true
  });
};

export const ensureCategoryForUser = async (
  userId: string,
  categoryName: string,
  amount: number
) => {
  const desiredType = amount >= 0 ? "income" : "expense";
  const existing = await prisma.category.findFirst({
    where: {
      userId,
      name: {
        equals: categoryName,
        mode: "insensitive"
      },
      type: desiredType
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.category.create({
    data: {
      userId,
      name: categoryName,
      type: desiredType,
      isAiSuggested: true
    }
  });
};

export const getUserCategoriesForAi = async (userId: string) => {
  const categories = await prisma.category.findMany({
    where: {
      userId
    },
    orderBy: {
      name: "asc"
    }
  });

  return categories.map((category: { name: string; type: "income" | "expense" }) => ({
    name: category.name,
    type: category.type
  }));
};
