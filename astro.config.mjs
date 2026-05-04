// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { 
    port: 3000
  },
  vite: {
    plugins: [tailwindcss(), basicSsl()],
    resolve: {
      alias: {
        // Fix for react-qr-barcode-scanner ESM issue
        'react-qr-barcode-scanner/dist/BarcodeScanner': 'react-qr-barcode-scanner/dist/BarcodeScanner.js',
        'react-qr-barcode-scanner/dist/BarcodeStringFormat': 'react-qr-barcode-scanner/dist/BarcodeStringFormat.js',
      }
    },
  },
  adapter: node({
    mode: "standalone",
  }),
  experimental: { session: true },
});
