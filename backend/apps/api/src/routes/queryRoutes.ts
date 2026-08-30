import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { naturalLanguageQuerySchema } from "../validators/queryValidators.js";
import { runNaturalLanguageQuery } from "../controllers/queryController.js";

export const queryRouter = Router();

queryRouter.post("/", validate(naturalLanguageQuerySchema), asyncHandler(runNaturalLanguageQuery));

