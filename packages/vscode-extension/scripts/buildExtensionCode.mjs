import * as esbuild from "esbuild";
import esbuildPluginLicense from "esbuild-plugin-license";
import fs from "fs";

const [mode] = process.argv.slice(2);

let buildConfig = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  outfile: "./dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
};

// build extension code
if (mode === "debug") {
  buildConfig = {
    ...buildConfig,
    sourcemap: true,
  };
}
if (mode === "production") {
  const licensesDir = "dist/third-party-licenses";

  // Ensure the license directory exists
  if (!fs.existsSync(licensesDir)) {
    fs.mkdirSync(licensesDir);
  }

  const licensePluginConfiguration = {
    thirdParty: {
      includePrivate: false,
      output: {
        file: "dist/third-party-licenses/extension-third-party.json",
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
              repository: dependency.packageJson.repository.url,
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

  buildConfig = {
    ...buildConfig,
    plugins: [esbuildPluginLicense(licensePluginConfiguration)],
    minify: true,
  };
}

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
