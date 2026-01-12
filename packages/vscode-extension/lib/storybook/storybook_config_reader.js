const { overrideModuleFromAppDependency, requireFromAppDependency } = require("../metro_helpers");

const { loadConfig } = requireFromAppDependency("react-native", "metro-config");

const newWithStorybook = (_config, options) => {
  if (!options?.configPath) {
    process.exit(1);
  }

  if (options?.enabled === false) {
    process.exit(1);
  }

  const { configPath } = options;

  process.stdout.write(`RADON_STORYBOOK_CONFIG_PATH:${configPath}\n`);
  process.exit(0);
}

const oldWithStorybookModule = requireFromAppDependency("@storybook/react-native", "metro/withStorybook");

let newWithStorybookModule = newWithStorybook;

// since Storybook 10 the module export has changed so we need to override it correctly 
// https://github.com/storybookjs/react-native/pull/786
if (oldWithStorybookModule?.withStorybook) {
  newWithStorybookModule = { withStorybook: newWithStorybook }
}

overrideModuleFromAppDependency("@storybook/react-native", "metro/withStorybook", newWithStorybookModule);

async function main() {
  const customMetroConfigPath = process.env.RN_IDE_METRO_CONFIG_PATH;
  let options = {};
  if (customMetroConfigPath) {
    options = { config: customMetroConfigPath };
  }
  await loadConfig(options, {});
  process.exit(1);
};

main();
