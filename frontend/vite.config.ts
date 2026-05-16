import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("axios")) return "vendor-network";
          if (id.includes("react-quill-new") || id.includes("quill")) return "vendor-editor";
          if (id.includes("highlight.js")) return "vendor-highlight";
          if (id.includes("dompurify")) return "vendor-sanitize";
          if (id.includes("qrcode")) return "vendor-qrcode";
          return "vendor-misc";
        },
      },
    },
  },
  server: {
    port: 5173,
    // Listen on 0.0.0.0 so the dev server is reachable from other devices on
    // the LAN (e.g. your phone on the same Wi-Fi). All /api and /uploads
    // calls are still proxied through Vite to the local backend, so the
    // backend doesn't need any extra CORS rules.
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // C6: dynamic OG share images live on the backend at /og/article/:slug.png
      "/og": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
