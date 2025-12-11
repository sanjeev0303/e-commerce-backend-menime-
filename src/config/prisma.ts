import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { dbLogger } from "../lib/logger";
import { ENV } from "./env";


// Create adapter with connection pooling configuration
const createAdapter = () => {
    const connectionString = ENV.DATABASE_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is not set");
    }

    // Append connection pool parameters if not already present
    const pooledUrl = connectionString.includes("connection_limit")
        ? connectionString
        : `${connectionString}${connectionString.includes("?") ? "&" : "?"}connection_limit=10&pool_timeout=30`;

    return new PrismaPg({
        connectionString: pooledUrl,
    });
};

// Create Prisma client with optimized settings
const createPrismaClient = () => {
    const adapter = createAdapter();

    const client = new PrismaClient({
        adapter,
        log:
            process.env.NODE_ENV === "development"
                ? [
                    { emit: "event", level: "query" },
                    { emit: "event", level: "error" },
                    { emit: "event", level: "warn" },
                ]
                : [{ emit: "event", level: "error" }],
    });

    // Log queries in development
    if (ENV.NODE_ENV === "development") {
        client.$on("query", (e) => {
            dbLogger.debug(
                {
                    query: e.query,
                    params: e.params,
                    duration: `${e.duration}ms`,
                },
                "Prisma Query"
            );
        });
    }

    // Log errors
    client.$on("error", (e) => {
        dbLogger.error({ message: e.message }, "Prisma Error");
    });

    client.$on("warn", (e) => {
        dbLogger.warn({ message: e.message }, "Prisma Warning");
    });

    return client;
};

// Use typeof for better TypeScript performance
type PrismaClientType = ReturnType<typeof createPrismaClient>;

// Global singleton to prevent multiple instances during hot reload
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientType | undefined;
};

// Export singleton instance
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Only cache in development to prevent hot reload issues
if (ENV.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

dbLogger.info(
    {
        environment: ENV.NODE_ENV || "development",
        singleton: !!globalForPrisma.prisma,
    },
    "Prisma client initialized with PostgreSQL adapter"
);

/**
 * Graceful disconnect helper
 * Call this during application shutdown
 */
export const disconnectPrisma = async (): Promise<void> => {
    try {
        await prisma.$disconnect();
        dbLogger.info("Prisma client disconnected successfully");
    } catch (error) {
        dbLogger.error({ error }, "Error disconnecting Prisma client");
        throw error;
    }
};
