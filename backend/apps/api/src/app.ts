import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes.js";
import { accountRouter } from "./routes/accountRoutes.js";
import { categoryRouter } from "./routes/categoryRoutes.js";
import { transactionRouter } from "./routes/transactionRoutes.js";
import { insightRouter } from "./routes/insightRoutes.js";
import { queryRouter } from "./routes/queryRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.use("/auth", authRouter);
app.use(requireAuth);
app.use("/accounts", accountRouter);
app.use("/categories", categoryRouter);
app.use("/transactions", transactionRouter);
app.use("/insights", insightRouter);
app.use("/query", queryRouter);

app.use(notFoundHandler);
app.use(errorHandler);

