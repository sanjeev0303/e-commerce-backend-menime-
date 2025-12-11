import { createApp } from "./app";
import { appLogger, dbLogger } from "./lib/logger";
import { disconnectPrisma, ENV } from "./config";

const port = Number(ENV.PORT || 3000);
const app = createApp();
const server = app.listen(port, () => {
  appLogger.info({ port }, `🚀 Server running on http://localhost:${port}`);
});

// Keep-alive cron job - ping health endpoint every 13 minutes to prevent Render from sleeping
const KEEP_ALIVE_INTERVAL = 13 * 60 * 1000; // 13 minutes in ms
let keepAliveTimer: NodeJS.Timeout | null = null;

const startKeepAlive = () => {
  if (ENV.NODE_ENV === "production") {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    
    keepAliveTimer = setInterval(async () => {
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        appLogger.info({ status: response.status }, "🏓 Keep-alive ping successful");
      } catch (error) {
        appLogger.warn({ error }, "⚠️ Keep-alive ping failed");
      }
    }, KEEP_ALIVE_INTERVAL);
    
    appLogger.info({ intervalMinutes: 13 }, "🕐 Keep-alive cron job started");
  }
};

startKeepAlive();

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

  // Clear keep-alive timer
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

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
