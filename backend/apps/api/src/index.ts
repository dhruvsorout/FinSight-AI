import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./services/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`FinSight API listening on port ${env.PORT}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

