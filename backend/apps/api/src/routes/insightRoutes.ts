import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { insightQuerySchema } from "../validators/insightValidators.js";
import { getInsights } from "../controllers/insightController.js";

export const insightRouter = Router();

insightRouter.get("/", validate(insightQuerySchema), asyncHandler(getInsights));

