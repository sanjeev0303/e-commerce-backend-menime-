import pinoHttp from "pino-http";
import { stdSerializers } from "pino";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

export const httpLoggerMiddleware = pinoHttp({
  logger,
  genReqId: (req) => req.id ?? randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    if (res.statusCode >= 300) return "info";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    const method = req.method;
    const url = req.url;
    const status = res.statusCode;
    return `${method} ${url} → ${status}`;
  },
  customErrorMessage: (req, res, err) => {
    const method = req.method;
    const url = req.url;
    const status = res.statusCode;
    return `${method} ${url} → ${status} ${err?.message ?? ""}`.trim();
  },
  customProps: (req) => ({
    userAgent: req.headers["user-agent"],
  }),
  serializers: {
    err: stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      query: req.query,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
