import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // The Google client id is public; it comes from the repo-root .env (GOOGLE_CLIENT_ID).
  const env = loadEnv(mode, repoRoot, "");
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(env.GOOGLE_CLIENT_ID ?? ""),
    },
    server: {
      // One origin in development, like CloudFront in production (ADR-0018): cookies just work.
      proxy: {
        "/api": "http://localhost:3000",
        "/ws": { target: "ws://localhost:3000", ws: true },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
    },
  };
});
