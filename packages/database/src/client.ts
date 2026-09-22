import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * `postgres()` connects lazily — constructing the client never touches the
 * network, only the first query does. That keeps `next build` and every
 * page that doesn't hit the database working with a placeholder
 * DATABASE_URL; only an actual query fails until a real database is wired
 * up (see the root README's "Before this goes live" section).
 */
const connectionString =
  process.env.DATABASE_URL ?? "postgres://user:password@localhost:5432/nexora";

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
