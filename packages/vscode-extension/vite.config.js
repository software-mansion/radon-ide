import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import license from "rollup-plugin-license";

export default defineConfig({
  plugins: [
    react(),
    license({
      sourcemap: true,
      cwd: process.cwd(), // The default
      thirdParty: {
        includePrivate: false,
        output: {
          file: path.join(__dirname, "dist/webview-NOTICES.json"),
          encoding: "utf-8", // Default is utf-8.
          // Template function that can be defined to customize report output
          template(dependencies) {
            const result = {
              root_name: "radon-ide-extension",
              third_party_libraries: [],
            };
            result.third_party_libraries = dependencies.map((dependency) => {
              return {
                package_name: dependency.name,
                package_version: dependency.version,
                repository: dependency.repository?.url,
                license: dependency.license,
                licenses: [
                  {
                    license: dependency.license,
                    text: dependency.licenseText,
                  },
                ],
              };
            });
            return JSON.stringify(result, null, 2);
          },
        },
      },
    }),
  ],
  base: "./", // Set the base to a relative path
  build: {
    outDir: "dist",
    emptyOutDir: false, // prevent out dir from being deleted when build starts – we keep additional build artifacts there
    assetsInlineLimit: 0, // disable assets inlining
    reportCompressedSize: false, // disable reporting compressed size
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        "panel": "src/webview/index.jsx",
        "network": "src/network/index.jsx",
        "react-devtools-profiler": "src/react-devtools-profiler/index.jsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: (assetInfo) =>
          assetInfo.name.endsWith(".css") ? "[name].css" : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 2137,
    strictPort: true,
    hmr: {
      host: "127.0.0.1",
    },
  },
});
