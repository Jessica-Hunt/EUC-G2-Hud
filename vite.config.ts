import { defineConfig } from "vite";

const APP_VERSION = process.env.npm_package_version ?? "0.0.0-dev";
const BUILD_STAMP = process.env.BUILD_STAMP ?? new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  // Allows the Even app's WebView to load the plugin
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow cross-origin requests from EUC World's local web server
    cors: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
