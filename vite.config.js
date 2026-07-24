import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const vitePrerender = require("vite-plugin-prerender");

export default defineConfig({
  plugins: [
    react(),
    vitePrerender({
      staticDir: path.join(__dirname, "dist"),
      routes: [
        "/",
        "/mobile",
        "/fastresearch",
        "/mes-trajets",
        "/settings",
        "/suivi-beta",
        "/infotrafic",
      ],
    }),
  ],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/tag": {
        target: "https://mobilites-m.fr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tag/, ""),
      },
    },
  },
});
