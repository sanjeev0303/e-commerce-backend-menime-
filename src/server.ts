import { createApp } from "./app";
import { appLogger, dbLogger } from "./lib/logger";
import { disconnectPrisma, ENV } from "./config";


const port = Number(ENV.PORT || 3000);
const app = createApp();
const server = app.listen(port, () => {
  appLogger.info({ port }, `🚀 Server running on http://localhost:${port}`);
});

let isShuttingDown = false;

const closeHttpServer = () =>
  new Promise<void>((resolve, reject) => {
    server.close((err: Error | undefined) => {
      if (err) return reject(err);
      resolve();
    });
  });

const shutDown = (signal: NodeJS.Signals) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  appLogger.warn({ signal }, "⚠️  Received shutdown signal, closing server...");

  const forcedShutdown = setTimeout(() => {
    appLogger.error("💥 Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000);

  (async () => {
    try {
      dbLogger.info("Disconnecting from database...");
      await disconnectPrisma();
      dbLogger.info("✅ Database disconnected");

      await closeHttpServer();
      appLogger.info("✅ HTTP server closed cleanly");
      process.exit(0);
    } catch (err) {
      appLogger.error({ err }, "💥 Error during server close");
      process.exit(1);
    } finally {
      clearTimeout(forcedShutdown);
    }
  })();
};

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);

process.on("unhandledRejection", (reason) => {
  appLogger.error({ reason }, "💥 Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  appLogger.fatal({ err }, "💥 Uncaught exception - shutting down");
  shutDown("SIGTERM");
});
