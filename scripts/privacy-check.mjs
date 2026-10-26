#!/usr/bin/env node
/**
 * Privacy check — run it before you publish the code or deploy the store.
 * `npm run verify` runs it too.
 *
 *   npm run privacy:check                  scan the project and its build output
 *   npm run privacy:check -- --history     also count matches in the git history
 *   npm run privacy:check -- --add         add a detail that must never ship
 *
 * Two kinds of check:
 *
 *  1. Built in, for any project: secret keys in files, committed .env files,
 *     server secrets exposed as NEXT_PUBLIC_ variables, and phone numbers
 *     hard-coded into WhatsApp links (the store reads its number from
 *     Settings, so the code never needs one).
 *
 *  2. Your blocklist: details that must never appear anywhere — a previous
 *     client's name, phone number, social handle or domain. `--add` asks for
 *     the detail without showing it and stores only a SHA-256 hash in
 *     .privacy/blocklist, which git ignores. Findings name the file, line and
 *     your label, never the value, so this output is safe to share.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ask, env, fail, root } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const blocklistFile = path.resolve(root, env("PRIVACY_BLOCKLIST") ?? ".privacy/blocklist");

/* --------------------------------------------------------- normalising */

/** "Café Noir" → "cafenoir", "+44 7700-900123" → "447700900123": case, accents and punctuation never matter. */
function normalise(value) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/* ---------------------------------------------------------------- --add */

if (args.has("--add")) {
  const label = (await ask("Label shown in findings (e.g. former-client-phone): ")).trim().replace(/\s+/g, "-");
  if (!/^[\w.-]{1,40}$/.test(label)) fail("Use letters, numbers and hyphens for the label.");
  const value = normalise(await ask("The detail itself (not shown, not saved): ", { hidden: true }));
  if (value.length < 4) fail("That is too short to check reliably (at least 4 letters or digits).");
  const hashes = [sha256(value)];
  // A phone number also matches when written in its national form.
  if (/^\d{9,15}$/.test(value)) hashes.push(sha256(value.slice(-9)));
  mkdirSync(path.dirname(blocklistFile), { recursive: true, mode: 0o700 });
  if (!existsSync(blocklistFile)) {
    appendFileSync(
      blocklistFile,
      "# Details that must never ship, as SHA-256 hashes. Managed with: npm run privacy:check -- --add\n",
      { mode: 0o600 },
    );
  }
  for (const hash of hashes) appendFileSync(blocklistFile, `${label} ${hash}\n`);
  console.log(`✓ Added “${label}” to ${path.relative(process.cwd(), blocklistFile)}`);
  process.exit(0);
}

/* ------------------------------------------------------------ blocklist */

const blocked = new Map(); // hash → label
if (existsSync(blocklistFile)) {
  for (const line of readFileSync(blocklistFile, "utf8").split("\n")) {
    const [label, hash] = line.trim().split(/\s+/);
    if (label && !label.startsWith("#") && /^[0-9a-f]{64}$/.test(hash ?? "")) blocked.set(hash, label);
  }
}

/** Labels of blocklisted details in one line of text. */
function blocklistHits(line) {
  if (blocked.size === 0) return [];
  const found = new Set();
  const check = (candidate) => {
    const label = blocked.get(sha256(candidate));
    if (label) found.add(label);
  };
  // Words, alone and joined with their neighbours ("Café Noir" = "cafenoir").
  const tokens = line.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = "";
    for (let size = 0; size < 4 && start + size < tokens.length; size += 1) {
      joined += tokens[start + size];
      if (joined.length >= 4 && joined.length <= 64) check(joined);
    }
  }
  // Numbers written with spaces, dots or dashes.
  for (const match of line.matchAll(/\+?\d[\d\s().-]{5,24}\d/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 8) {
      check(digits);
      check(digits.slice(-9));
    }
  }
  return [...found];
}

/* --------------------------------------------------------------- files */

const quiet = { stdio: ["ignore", "pipe", "ignore"] };

/** What git would publish; outside a git checkout, every file but the usual ignored ones. */
function projectFiles() {
  try {
    return execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], quiet)
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  } catch {
    const skipDirs = [".git", "node_modules", ".next", ".data", ".data-backups", ".privacy", "playwright-report", "test-results"];
    const skipPaths = ["tests/.artifacts", "supabase/.temp", "supabase/.branches"];
    const out = [];
    const walk = (dir) => {
      for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const relative = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirs.includes(entry.name) && !skipPaths.includes(relative)) walk(relative);
        } else if (!/^\.env(?!\.example$)/.test(entry.name) && !/\.tsbuildinfo$|^\.DS_Store$|^next-env\.d\.ts$/.test(entry.name)) {
          out.push(relative);
        }
      }
    };
    walk("");
    return out;
  }
}

function filesUnder(dir) {
  const full = path.join(root, dir);
  if (!existsSync(full)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) walk(next);
      else out.push(path.relative(root, next));
    }
  };
  walk(full);
  return out;
}

function readText(relative) {
  const full = path.join(root, relative);
  if (!existsSync(full)) return null;
  const info = statSync(full);
  if (!info.isFile() || info.size > 15_000_000) return null;
  const buffer = readFileSync(full);
  if (buffer.subarray(0, 8000).includes(0)) return null; // binary
  return buffer.toString("utf8");
}

/* ------------------------------------------------------------- checks */

const findings = [];
const report = (level, file, line, message) => findings.push({ level, file, line, message });

const mask = (value) =>
  value.length <= 4 ? "•".repeat(value.length) : `${value.slice(0, 2)}${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-2)}`;

/** Fictional numbers that are safe in examples and placeholders. */
const FICTIONAL_PHONES = [/^447700900\d{0,3}$/, /^1\d{3}5550[01]\d{2}$/, /^0{6,}$/];
const RESERVED_EMAIL = /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;

function builtInChecks(file, lines) {
  const isDoc = /\.(md|mdx|txt)$/i.test(file);
  const isLock = /(^|\/)package-lock\.json$/.test(file);
  lines.forEach((line, index) => {
    const at = index + 1;
    if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(line)) report("error", file, at, "Supabase secret key");
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line)) report("error", file, at, "private key");
    for (const match of line.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
      let role = "";
      try {
        role = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8")).role ?? "";
      } catch {
        // not a JWT after all
      }
      if (role === "service_role") report("error", file, at, "Supabase service-role key");
      else if (role) report("warning", file, at, `hard-coded ${role} key — keys belong in environment variables`);
    }
    if (/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PASSWORD|PRIVATE)/.test(line)) {
      report("error", file, at, "a secret named NEXT_PUBLIC_… would be sent to every browser");
    }
    if (file === ".env.example" && /^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SESSION_SECRET|ADMIN_SETUP_TOKEN)=\S/.test(line)) {
      report("error", file, at, "the template must not contain a real secret");
    }
    for (const match of line.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)\+?(\d{6,})/g)) {
      if (FICTIONAL_PHONES.some((pattern) => pattern.test(match[1]))) continue;
      report("error", file, at, `hard-coded WhatsApp number (${mask(match[1])}) — set the number in Settings instead`);
    }
    if (!isLock) {
      for (const match of line.matchAll(/(?<![\w/#=-])\+\d[\d\s().-]{7,18}\d(?![\w-])/g)) {
        const digits = match[0].replace(/\D/g, "");
        if (digits.length < 8 || digits.length > 15 || FICTIONAL_PHONES.some((pattern) => pattern.test(digits))) continue;
        report("warning", file, at, `phone number (${mask(digits)}) — use a fictional one like +44 7700 900123 in examples`);
      }
      for (const match of line.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
        if (RESERVED_EMAIL.test(match[0]) || /\.(png|jpe?g|webp|svg|js|ts|tsx|css)$/i.test(match[0])) continue;
        if (!isDoc && !/^(src|public|supabase|scripts)\//.test(file)) continue;
        const [user, host] = match[0].split("@");
        report("warning", file, at, `email address (${mask(user)}@${mask(host)}) — use an @example.com address in examples`);
      }
    }
  });
}

function blocklistChecks(file, lines, level = "error") {
  for (const label of blocklistHits(file)) report(level, file, 0, `file name contains “${label}”`);
  lines.forEach((line, index) => {
    for (const label of blocklistHits(line)) report(level, file, index + 1, `contains “${label}”`);
  });
}

const files = projectFiles();
let scanned = 0;

// The ignore rules that keep secrets and local data out of git.
const gitignore = existsSync(path.join(root, ".gitignore")) ? readFileSync(path.join(root, ".gitignore"), "utf8") : "";
for (const rule of [".env", ".data", ".privacy"]) {
  if (!gitignore.split("\n").some((line) => line.trim().replace(/^\//, "").startsWith(rule))) {
    report("error", ".gitignore", 0, `has no rule for ${rule}… — add it so it can never be committed`);
  }
}

for (const file of files) {
  const base = path.basename(file);
  if (/^\.env/.test(base) && base !== ".env.example") report("error", file, 0, "environment file in the repository — keep it out of git");
  const text = readText(file);
  if (text === null) {
    blocklistChecks(file, []);
    continue;
  }
  scanned += 1;
  const lines = text.split("\n");
  builtInChecks(file, lines);
  blocklistChecks(file, lines);
}

// Staged additions that were deleted from disk would still be committed.
try {
  const staged = execFileSync("git", ["-C", root, "diff", "--cached", "--name-only", "--diff-filter=A", "-z"], quiet)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const missing = staged.filter((file) => !existsSync(path.join(root, file)));
  if (missing.length > 0) {
    report(
      "warning",
      missing[0],
      0,
      `${missing.length} file(s) are staged for the next commit but no longer exist on disk — review with \`git status\` before committing`,
    );
  }
} catch {
  // not a git checkout
}

// The build: what browsers download must be clean. The server build embeds
// absolute paths, so it is only checked when this folder's path is clean.
const browserFiles = filesUnder(".next/static");
for (const file of browserFiles) {
  const text = readText(file);
  if (text === null) continue;
  scanned += 1;
  const lines = text.split("\n");
  builtInChecks(file, lines);
  blocklistChecks(file, lines);
}
const rootHits = blocklistHits(root);
if (rootHits.length > 0) {
  report(
    "warning",
    "(project folder)",
    0,
    `this folder's path contains “${rootHits.join("”, “")}”. Builds embed absolute paths in server files, ` +
      "so build and deploy from a neutrally named folder (a host that builds from git already does).",
  );
} else {
  for (const file of filesUnder(".next/server")) {
    const text = readText(file);
    if (text === null) continue;
    scanned += 1;
    blocklistChecks(file, text.split("\n"));
  }
}

// The remote's address is published with every clone and fork.
try {
  const remotes = execFileSync("git", ["-C", root, "remote", "-v"], quiet).toString("utf8");
  for (const label of blocklistHits(remotes)) report("warning", "(git remote)", 0, `the remote repository's address contains “${label}”`);
} catch {
  // no git
}

/* -------------------------------------------------------------- history */

if (args.has("--history")) {
  const counts = new Map();
  try {
    const log = execFileSync("git", ["-C", root, "log", "-p", "--all", "--no-color", "--text", "--format=commit %H"], {
      maxBuffer: 1 << 30,
    }).toString("utf8");
    let commit = "";
    for (const line of log.split("\n")) {
      if (line.startsWith("commit ")) {
        commit = line.slice(7);
        continue;
      }
      if (!line.startsWith("+") && !line.startsWith("-")) continue;
      const labels = new Set(blocklistHits(line));
      for (const match of line.matchAll(/wa\.me\/\+?(\d{6,})/g)) labels.add(`whatsapp number ${mask(match[1])}`);
      for (const label of labels) {
        const entry = counts.get(label) ?? new Set();
        entry.add(commit);
        counts.set(label, entry);
      }
    }
  } catch (error) {
    console.warn(`Could not read the git history: ${error.message}`);
  }
  console.log("\nGit history (every commit, every branch):");
  if (counts.size === 0) console.log("  nothing found");
  for (const [label, commits] of counts) {
    console.log(`  “${label}” appears in ${commits.size} commit(s)`);
  }
  if (counts.size > 0) {
    console.log("  History is not rewritten by this tool. Publish from a fresh repository, or rewrite history deliberately.");
  }
}

/* --------------------------------------------------------------- output */

const errors = findings.filter((finding) => finding.level === "error");
const warnings = findings.filter((finding) => finding.level === "warning");

console.log(`\nPrivacy check — ${scanned} text files scanned, ${blocked.size} blocklisted hash(es)`);
if (blocked.size === 0) {
  console.log("  No blocklist yet. Add a previous client's details with: npm run privacy:check -- --add");
}
const show = (finding) =>
  console.log(`  ${finding.level === "error" ? "✗" : "!"} ${finding.file}${finding.line ? `:${finding.line}` : ""}  ${finding.message}`);
const limit = (list) => {
  list.slice(0, 50).forEach(show);
  if (list.length > 50) console.log(`  … and ${list.length - 50} more`);
};
limit(errors);
limit(warnings);
console.log(
  errors.length === 0
    ? `✓ No problems${warnings.length ? `, ${warnings.length} warning(s) to review` : ""}.`
    : `✗ ${errors.length} problem(s), ${warnings.length} warning(s).`,
);
process.exit(errors.length > 0 ? 1 : 0);
