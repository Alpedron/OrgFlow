import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* requests to Express so no CORS issues during dev
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
