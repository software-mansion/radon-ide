import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  root: "../../../",
  plugins: [react()],
  base: "./", // Set the base to a relative path
  build: {
    outDir: "../../../dist",
    emptyOutDir: false, // prevent out dir from being deleted when build starts – we keep additional build artifacts there
    assetsInlineLimit: 0, // disable assets inlining
    reportCompressedSize: false, // disable reporting compressed size
    rollupOptions: {
      input: "./index.jsx",
      output: {
        // Fixed name for the JavaScript entry file
        entryFileNames: "network.js",
        // Fixed name for the CSS file
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".css")) {
            return "webview.css";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  server: {
    port: 2136,
    hmr: {
      host: "127.0.0.1",
    },
  },
});
