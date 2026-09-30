import { createApp } from "./app";
import { env } from "./env";
import { prisma } from "./lib/db";
import { logger } from "./lib/logger";

const server = createApp().listen(env.PORT, () => {
  logger.info(`server listening on http://localhost:${env.PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
