// env.d.ts
import { D1Database } from "@cloudflare/workers-types";

interface CloudflareEnv {
  logistics_db: D1Database;
  API_KEY: string;
}