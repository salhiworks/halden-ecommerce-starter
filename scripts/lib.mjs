/**
 * Small helpers shared by the scripts in this folder. Plain Node (>= 20.9),
 * no TypeScript and no path aliases, so they run without a build step.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Loads `.env.local`, then `.env`, the way Next.js does for the app — so a
 * script sees the same configuration. Variables already set win.
 */
export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      const quoted = value.match(/^(['"])(.*)\1$/);
      if (quoted) value = quoted[2];
      else value = value.replace(/\s+#.*$/, "");
      process.env[match[1]] = value;
    }
  }
}

export function env(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Which backend the app would use with this environment. Mirrors src/server/env.ts. */
export function backendKind() {
  const explicit = env("STORE_BACKEND");
  if (explicit === "local" || explicit === "supabase") return explicit;
  const supabase = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  return supabase.some((name) => env(name)) ? "supabase" : "local";
}

/** The Supabase CLI version every script and guide uses. */
export const SUPABASE_CLI = "supabase@2.120.0";

/**
 * Runs the Supabase CLI through npx (downloaded on first use; nothing to
 * install). With `capture`, output is returned instead of shown — used for
 * anything that contains keys, which must never appear on screen.
 */
export function supabase(args, { capture = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["--yes", SUPABASE_CLI, ...args], {
      cwd: root,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      // Windows needs a shell to start npx.cmd.
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: String(error) }));
  });
}

/** Runs another script of this project with the same terminal. */
export function runNode(args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...extraEnv } });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/**
 * Sets variables in .env.local, keeping every other line as it was.
 * Values are written, never printed.
 */
export function writeEnvLocal(values) {
  const file = path.join(root, ".env.local");
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
  for (const [name, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => new RegExp(`^\\s*(export\\s+)?${name}\\s*=`).test(line));
    if (index >= 0) lines[index] = `${name}=${value}`;
    else lines.push(`${name}=${value}`);
    process.env[name] = value;
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const temp = `${file}.tmp`;
  writeFileSync(temp, `${lines.join("\n")}\n`, { mode: 0o600 });
  renameSync(temp, file);
}

export function localDataDir() {
  return path.resolve(root, env("STORE_DATA_DIR") ?? ".data");
}

/** Asks a question on the terminal. With `hidden`, typed characters are not shown. */
export function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) {
    return Promise.reject(new Error("This needs an interactive terminal (or the value in an environment variable)."));
  }
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the prompt, then swallow the echo of everything typed after it.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
        else if (text.includes("\n") || text.includes("\r")) rl.output.write("\n");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** The project ref in a Supabase URL: https://<ref>.supabase.co */
export function projectRefOf(url) {
  return url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/)?.[1] ?? null;
}

/**
 * Applies every file in supabase/migrations, in order, through the CLI's
 * Management API connection — no database password needed. Each migration
 * is written to be safe to run again, so this is also how you upgrade.
 */
export async function applyMigrations(ref) {
  const files = readdirSync(path.join(root, "supabase", "migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const result = await supabase(["db", "query", "--linked", "--project-ref", ref, "-f", `supabase/migrations/${file}`], {
      capture: true,
    });
    if (result.code !== 0) fail(`Could not apply ${file}:\n${result.stderr.trim() || result.stdout.trim()}`);
    console.log(`   ✓ ${file}`);
  }
}
