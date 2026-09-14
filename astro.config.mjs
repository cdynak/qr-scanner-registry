// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Select the deployment adapter:
// - On Vercel (VERCEL=1 is set automatically in their build), or when
//   DEPLOY_TARGET=vercel, use the Vercel serverless adapter.
// - Otherwise use the Node standalone adapter (local dev, self-hosting).
const useVercel = process.env.VERCEL === "1" || process.env.DEPLOY_TARGET === "vercel";
const adapter = useVercel ? vercel() : node({ mode: "standalone" });

// The local HTTPS plugin is only needed for `astro dev`; skip it on Vercel.
const vitePlugins = [tailwindcss()];
if (!useVercel) {
  vitePlugins.push(basicSsl());
}

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
    plugins: vitePlugins,
    resolve: {
      alias: {
        // Fix for react-qr-barcode-scanner ESM issue
        "react-qr-barcode-scanner/dist/BarcodeScanner": "react-qr-barcode-scanner/dist/BarcodeScanner.js",
        "react-qr-barcode-scanner/dist/BarcodeStringFormat": "react-qr-barcode-scanner/dist/BarcodeStringFormat.js",
      },
    },
  },
  adapter,
  // Sessions are stable as of Astro 5.7+ and enabled automatically by the
  // adapter, so the experimental flag is no longer required.
});
