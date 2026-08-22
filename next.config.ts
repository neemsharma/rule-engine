import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a pnpm-workspace.yaml exists higher
  // up in /var/www/html which Turbopack would otherwise try to use).
  turbopack: { root: projectRoot },
  // Do not auto-generate AGENTS.md / CLAUDE.md in the repo.
  agentRules: false,
  // PGlite ships a WASM binary; keep it external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
