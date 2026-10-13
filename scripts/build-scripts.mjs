/**
 * Bundles the CLI scripts that run inside the production image (seed, Ghost migration, env check)
 * into self-contained ESM files in dist/. Native modules stay external; they ship with the Next standalone output.
 */
import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  logLevel: "info",
  tsconfig: "tsconfig.json",
  external: ["sharp", "@node-rs/argon2", "pg-native"],
  // Some bundled CommonJS dependencies call require(); provide it in the ESM output.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirnameOf } from 'node:path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirnameOf(__filename);",
    ].join("\n"),
  },
  define: { "process.env.NODE_ENV": '"production"' },
};

await build({
  ...shared,
  entryPoints: {
    seed: "prisma/seed.ts",
    "migrate-ghost": "scripts/migrate-ghost.ts",
    "migrate-db": "scripts/migrate-db.ts",
    "check-env": "scripts/check-env.ts",
  },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
});
