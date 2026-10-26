import { defineConfig } from "vitest/config";

export default defineConfig({
  // `@/*` path aliases are read straight from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/**/*.test.ts", "scripts/**/*.test.ts"],
    // The database tests boot an in-process Postgres (PGlite); give them room.
    testTimeout: 30_000,
  },
});
