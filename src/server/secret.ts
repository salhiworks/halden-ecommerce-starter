import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken, sha256 } from "@/server/crypto";
import { localDataDir, supabaseConfig } from "@/server/env";

/**
 * A server-side secret for signing short-lived values (the checkout form
 * token). SESSION_SECRET wins when set; otherwise it is derived from the
 * Supabase secret key, or kept in `.data/` for a local store.
 */
let cached: string | null = null;

export async function appSecret(): Promise<string> {
  if (cached) return cached;
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return (cached = fromEnv);

  const supabase = supabaseConfig();
  if (supabase?.secretKey) return (cached = sha256(`storefront-form-tokens:${supabase.secretKey}`));

  const file = path.join(localDataDir(), "app-secret");
  try {
    cached = (await readFile(file, "utf8")).trim();
  } catch {
    cached = randomToken(48);
    await mkdir(localDataDir(), { recursive: true });
    await writeFile(file, cached, { mode: 0o600 });
  }
  return cached;
}
