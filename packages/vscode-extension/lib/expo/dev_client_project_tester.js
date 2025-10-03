const { requireFromAppDependency, appRoot } = require("../metro_helpers");

const { resolveOptionsAsync } = requireFromAppDependency("expo", "@expo/cli/build/src/start/resolveOptions");

// This is a test script to ensure that the project is dev client project.
// It is expected to fail either due to missing imports or because of devClient flag is set to false/ undefined.
async function main() {
  const { devClient } = await resolveOptionsAsync(appRoot, {});
  if (!devClient) {
    throw new Error("Dev client is not enabled");
  }
}

main();
