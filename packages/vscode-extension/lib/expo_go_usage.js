const { requireFromAppDir, appRoot } = require("./metro_helpers");
const { resolveOptionsAsync } = requireFromAppDir("@expo/cli/build/src/start/resolveOptions");

async function main() {
  const { devClient } = await resolveOptionsAsync(appRoot, {});
  console.log(!devClient);
}

main();
