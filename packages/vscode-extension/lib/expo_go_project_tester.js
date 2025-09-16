const { requireFromAppDir, resolveFromAppDir, appRoot } = require("./metro_helpers");
const expoInstallPath = resolveFromAppDir("expo");
const { resolveOptionsAsync } = requireFromAppDir("@expo/cli/build/src/start/resolveOptions", {
  paths: [expoInstallPath],
});

// This is a test script to ensure that the `expo-go-project` package can be imported and used in a project.
// It is expected to fail either due to missing imports or because of devClient flag is set which indicates that the project
// is not an Expo Go project.
async function main() {
  const { devClient } = await resolveOptionsAsync(appRoot, {});
  if (devClient) {
    throw new Error("Dev client is enabled");
  }
}

main();
