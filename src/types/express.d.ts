import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth: () => {
        userId: string | null;
        sessionId: string | null;
        getToken: (options?: { template?: string }) => Promise<string | null>;
        claims: Record<string, unknown> | null;
      };
      user?: User;
    }
  }
}
