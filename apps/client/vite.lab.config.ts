import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The floor lab (lab.html): the real client, playing against the server's GameRoom in the browser
 * with a simulated crowd. Builds to dist-lab; `lab:build` also inlines it into one HTML file.
 */
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
  build: {
    outDir: "dist-lab",
    emptyOutDir: true,
    rollupOptions: { input: "lab.html" },
  },
});
