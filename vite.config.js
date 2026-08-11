import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["elva-unbroke-supervigorously.ngrok-free.dev"],
    proxy: {
      "/tag": {
        target: "https://mobilites-m.fr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tag/, ""),
      },
    },
  },
});
