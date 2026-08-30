import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import {
  accountCreateSchema,
  accountIdParamSchema,
  accountUpdateSchema
} from "../validators/accountValidators.js";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount
} from "../controllers/accountController.js";

export const accountRouter = Router();

accountRouter.get("/", asyncHandler(listAccounts));
accountRouter.post("/", validate(accountCreateSchema), asyncHandler(createAccount));
accountRouter.put("/:id", validate(accountUpdateSchema), asyncHandler(updateAccount));
accountRouter.delete("/:id", validate(accountIdParamSchema), asyncHandler(deleteAccount));

