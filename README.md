# Menime Backend

TypeScript Express starter.

## Scripts
- `npm run dev` – start dev server with hot reload (entry: `src/server.ts`)
- `npm run build` – compile TypeScript to `dist`
- `npm start` – run compiled server (`dist/server.js`)
- `npm run prisma:generate` – generate Prisma client
- `npm run prisma:push` – sync schema to database
- `npm run prisma:studio` – open Prisma Studio

## Structure
- `src/app.ts` – Express app factory with middleware/routes
- `src/server.ts` – bootstrap and graceful shutdown
- `src/lib/prisma.ts` – Prisma client
- `src/controllers/` – Request handlers
- `src/routes/` – Route definitions
- `src/middlewares/` – Express middlewares
- `src/services/` – Business logic


## Setup
1. Copy `.env.example` to `.env` and adjust values.
2. Install dependencies: `npm install`.
3. Start in dev: `npm run dev`.
