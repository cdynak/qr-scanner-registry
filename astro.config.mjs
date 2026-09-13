// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://astro.build/config
export default defineConfig({
  output: "server",
  // `site` is required by the sitemap integration and used for canonical URLs.
  // Override via the SITE env var for production deployments.
  site: process.env.SITE || "http://localhost:3000",
  integrations: [react(), sitemap()],
  server: {
    port: 3000,
  },
  vite: {
    plugins: [tailwindcss(), basicSsl()],
    resolve: {
      alias: {
        // Fix for react-qr-barcode-scanner ESM issue
        "react-qr-barcode-scanner/dist/BarcodeScanner": "react-qr-barcode-scanner/dist/BarcodeScanner.js",
        "react-qr-barcode-scanner/dist/BarcodeStringFormat": "react-qr-barcode-scanner/dist/BarcodeStringFormat.js",
      },
    },
  },
  adapter: node({
    mode: "standalone",
  }),
  // Sessions are stable as of Astro 5.7+ and enabled automatically by the
  // Node adapter, so the experimental flag is no longer required.
});
