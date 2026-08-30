import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { csvUpload } from "../middleware/upload.js";
import {
  bulkCategorizeSchema,
  transactionCreateSchema,
  transactionFilterSchema,
  transactionIdParamSchema,
  transactionUpdateSchema
} from "../validators/transactionValidators.js";
import {
  categorizeTransaction,
  categorizeUncategorizedTransactions,
  createTransaction,
  deleteTransaction,
  importTransactions,
  listTransactions,
  updateTransaction
} from "../controllers/transactionController.js";

export const transactionRouter = Router();

transactionRouter.get("/", validate(transactionFilterSchema), asyncHandler(listTransactions));
transactionRouter.post("/", validate(transactionCreateSchema), asyncHandler(createTransaction));
transactionRouter.post(
  "/import",
  csvUpload.single("file"),
  asyncHandler(importTransactions)
);
transactionRouter.post(
  "/categorize-uncategorized",
  validate(bulkCategorizeSchema),
  asyncHandler(categorizeUncategorizedTransactions)
);
transactionRouter.post("/:id/categorize", validate(transactionIdParamSchema), asyncHandler(categorizeTransaction));
transactionRouter.put("/:id", validate(transactionUpdateSchema), asyncHandler(updateTransaction));
transactionRouter.delete("/:id", validate(transactionIdParamSchema), asyncHandler(deleteTransaction));

