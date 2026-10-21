import { defineConfig } from "vite";

/** The floor lab (playtest.html): a separate page that plays the floor files with the engine. */
export default defineConfig({
  server: { fs: { allow: ["../.."] } },
  build: {
    outDir: "dist-playtest",
    emptyOutDir: true,
    rollupOptions: { input: "playtest.html" },
  },
});
