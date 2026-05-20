import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendPort = process.env.BACKEND_PORT ?? "8001";
const vitePort = Number(process.env.VITE_PORT ?? 5174);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: vitePort,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
