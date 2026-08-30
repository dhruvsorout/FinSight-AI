import type { Request, Response } from "express";
import { aiClient } from "../services/aiClient.js";
import { fallbackStructuredQuery } from "../services/fallbackAi.js";
import { getUserCategoriesForAi } from "../services/categoryService.js";
import { executeStructuredQuery, formatGroundedAnswer } from "../services/queryService.js";

const availableFields: Array<{
  field: "categoryName" | "accountName" | "transactionType" | "date";
  description: string;
  operators: Array<"equals" | "between">;
}> = [
  {
    field: "categoryName",
    description: "The transaction category label.",
    operators: ["equals"]
  },
  {
    field: "accountName",
    description: "The account name attached to the transaction.",
    operators: ["equals"]
  },
  {
    field: "transactionType",
    description: "Whether the transaction is income or expense.",
    operators: ["equals"]
  },
  {
    field: "date",
    description: "The transaction date.",
    operators: ["between"]
  }
];

export const runNaturalLanguageQuery = async (req: Request, res: Response) => {
  const categories = await getUserCategoriesForAi(req.auth!.sub);
  let structured;

  try {
    structured = await aiClient.query({
      question: req.body.question,
      availableFields: [...availableFields],
      categories
    });
  } catch {
    structured = fallbackStructuredQuery(req.body.question);
  }

  const result = await executeStructuredQuery(req.auth!.sub, structured.query);
  const answer = formatGroundedAnswer(req.body.question, structured.query, result);

  res.json({
    answer,
    provider: structured.provider,
    groundedQuery: structured.query,
    result
  });
};
