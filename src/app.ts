import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";

import { httpLoggerMiddleware } from "./middlewares/http-logger";
import { appLogger } from "./lib/logger";
import { ENV } from "./config";
import { functions, inngest } from "./config/inngest";

import adminRoutes from "./routes/admin.route";
import userRoutes from "./routes/user.route";
import orderRoutes from "./routes/order.route";
import reviewRoutes from "./routes/review.route";
import productRoutes from "./routes/product.route";
import cartRoutes from "./routes/cart.route";


type CreateAppOptions = {
  enableCors?: boolean;
  enableCompression?: boolean;
  trustProxy?: boolean | number | string;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const __dirname = path.resolve();

  // Trust proxy for proper IP detection behind load balancers/reverse proxies
  if (options.trustProxy ?? ENV.NODE_ENV === "production") {
    app.set("trust proxy", options.trustProxy === true ? 1 : options.trustProxy);
  }

  // Disable x-powered-by header for security
  app.disable("x-powered-by");

  // Body parsing with size limits for security
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));

  // Auth
  app.use(clerkMiddleware());

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: ENV.NODE_ENV === "production",
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  if (options.enableCors ?? true) {
    app.use(
      cors({
        origin: ENV.CLIENT_URL || process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400, // 24 hours preflight cache
      })
    );
  }

  // Compression for responses
  if (options.enableCompression ?? true) {
    app.use(compression());
  }

  // HTTP request logging
  app.use(httpLoggerMiddleware);

  // Inngest
  app.use("/api/inngest", serve({ client: inngest, functions }));

  // API Routes
  app.use("/api/admin", adminRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/cart", cartRoutes);

  // Health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({ message: "Success" });
  });

  // Production static files
  if (ENV.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../admin/dist")));

    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../admin", "dist", "index.html"));
    });
  }

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: "Resource not found",
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    appLogger.error(
      {
        err,
        method: req.method,
        url: req.url,
        body: req.body,
      },
      "Unhandled error"
    );

    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
      success: false,
      message:
        ENV.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
      ...(ENV.NODE_ENV !== "production" && { stack: err.stack }),
    });
  });

  return app;
}
