/**
 * Prisma 7 config: connection URL for Migrate/CLI.
 * Required when schema has no `url` in datasource (Prisma 7).
 * Load .env before reading DATABASE_URL.
 */
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
