const defaultConfig = {
  IS_RECORDING: false,

  // Android devices do not work on github actions macOS runners nor local macOS VMs
  // This is possibly caused by the lack of support for hardware acceleration in virtualized environments (HVF error: HV_UNSUPPORTED)
  // I didn't find any way to turn this acceleration off
  // GitHub issues related to this topic:
  // https://github.com/ReactiveCircus/android-emulator-runner/issues/350
  // https://github.com/utmapp/UTM/issues/6821
  // android tests can be run on a local machine with android studio installed
  IS_ANDROID: true,
  IS_GITHUB_ACTIONS: false,
  // Allows tests to modify the environment (e.g. disabling node)
  // Enabling this may lead to unexpected behavior.
  ALLOW_ENVIRONMENT_MODIFICATIONS: false,
};

function prioritizeEnv(field) {
  const envValue = process.env[field];
  const defaultConfigValue = defaultConfig[field];
  return envValue !== undefined ? envValue === "true" : defaultConfigValue;
}

export default function getConfiguration() {
  const IS_RECORDING = prioritizeEnv("IS_RECORDING");
  const IS_ANDROID = prioritizeEnv("IS_ANDROID");
  const IS_GITHUB_ACTIONS = prioritizeEnv("IS_GITHUB_ACTIONS");
  const ALLOW_ENVIRONMENT_MODIFICATIONS = prioritizeEnv(
    "ALLOW_ENVIRONMENT_MODIFICATIONS"
  );

  return {
    IS_RECORDING,
    IS_ANDROID,
    IS_GITHUB_ACTIONS,
    ALLOW_ENVIRONMENT_MODIFICATIONS,
  };
}
