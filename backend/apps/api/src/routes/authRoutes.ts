import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, logoutSchema, refreshSchema, signupSchema } from "../validators/authValidators.js";
import { login, logout, refresh, signup } from "../controllers/authController.js";

export const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), asyncHandler(signup));
authRouter.post("/login", validate(loginSchema), asyncHandler(login));
authRouter.post("/refresh", validate(refreshSchema), asyncHandler(refresh));
authRouter.post("/logout", validate(logoutSchema), asyncHandler(logout));

