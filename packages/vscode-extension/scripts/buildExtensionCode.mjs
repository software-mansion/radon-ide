import * as esbuild from "esbuild";
import esbuildPluginLicense from "esbuild-plugin-license";
import fs from "fs";
import babel from "esbuild-plugin-babel";

const [mode] = process.argv.slice(2);

const plugins = [];

if (mode === "production") {
  const licensePluginConfiguration = {
    thirdParty: {
      includePrivate: false,
      output: {
        file: "./dist/extension-NOTICES.json",
        // Template function that can be defined to customize report output
        template(dependencies) {
          const result = {
            root_name: "radon-ide-extension",
            third_party_libraries: [],
          };
          result.third_party_libraries = dependencies.map((dependency) => {
            return {
              package_name: dependency.packageJson.name,
              package_version: dependency.packageJson.version,
              repository: dependency.packageJson.repository?.url,
              license: dependency.packageJson.license,
              licenses: [
                {
                  license: dependency.packageJson.license,
                  text: dependency.licenseText,
                },
              ],
            };
          });
          return JSON.stringify(result, null, 2);
        },
      },
    },
  };

  plugins.push(esbuildPluginLicense(licensePluginConfiguration));
}

// build extension code
let buildConfig = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  outfile: "./dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  plugins,
  sourcemap: mode === "debug",
};

await esbuild.build(buildConfig);

// add mapping to dist
const sourceMapMappingsPath = "node_modules/source-map/lib/mappings.wasm";
const newSourceMapMappingsPath = "dist/mappings.wasm";

try {
  fs.copyFileSync(sourceMapMappingsPath, newSourceMapMappingsPath);
  console.log("File copied successfully.");
} catch (err) {
  console.error("Error copying file:", err);
}

await esbuild.build({
  entryPoints: ["./node_modules/@expo/fingerprint/build/sourcer/ExpoConfigLoader.js"],
  bundle: true,
  outfile: "dist/ExpoConfigLoader.js",
  format: "cjs",
  platform: "node",
  minify: true,
});

await esbuild.build({
  entryPoints: ["./src/runtime/connect_runtime.ts"],
  bundle: true,
  outfile: "dist/connect_runtime.js",
  platform: "neutral",
  plugins: [
    babel({
      config: {
        presets: ["@babel/preset-env", "@babel/preset-typescript"],
      },
    }),
  ],
  minify: false,
});
