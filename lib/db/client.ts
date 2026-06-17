import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../config/env";
import * as schema from "./schema";

// Lazy DB client so importing the schema (for typegen / migration generation) never connects.

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

export function getDb(): Db {
  if (!cached) {
    const { DATABASE_URL } = getEnv();
    cached = drizzle(postgres(DATABASE_URL), { schema });
  }
  return cached;
}

export { schema };
