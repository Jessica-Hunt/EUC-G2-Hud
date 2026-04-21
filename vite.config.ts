import { defineConfig } from "vite";

export default defineConfig({
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
