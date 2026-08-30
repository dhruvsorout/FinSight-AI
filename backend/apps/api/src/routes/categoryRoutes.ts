import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import {
  categoryCreateSchema,
  categoryIdParamSchema,
  categoryUpdateSchema
} from "../validators/categoryValidators.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
} from "../controllers/categoryController.js";

export const categoryRouter = Router();

categoryRouter.get("/", asyncHandler(listCategories));
categoryRouter.post("/", validate(categoryCreateSchema), asyncHandler(createCategory));
categoryRouter.put("/:id", validate(categoryUpdateSchema), asyncHandler(updateCategory));
categoryRouter.delete("/:id", validate(categoryIdParamSchema), asyncHandler(deleteCategory));

