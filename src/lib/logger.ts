import pino from "pino";
import { ENV } from "../config/env";


const level = ENV.LOG_LEVEL || "info";
const isDev = ENV.NODE_ENV !== "production";

const baseLogger = pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
    },
    transport: isDev
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss.l",
                levelFirst: true,
                ignore: "pid,hostname",
                customColors: "error:red,warn:yellow,info:green,debug:blue,trace:gray,fatal:bgRed",
                messageFormat: "{msg}",
                singleLine: false,
            },
        }
        : undefined,
});

// Child loggers for different modules
export const logger = baseLogger;

export const createLogger = (module: string) =>
    baseLogger.child({ module });

// Pre-configured module loggers
export const dbLogger = createLogger("database");
export const httpLogger = createLogger("http");
export const appLogger = createLogger("app");
