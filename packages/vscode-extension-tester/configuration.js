export default {
  isRecording: process.env.IS_RECORDING === "true",

  // Android devices do not work on github actions macOS runners nor local macOS VMs
  // This is possibly caused by the lack of support for hardware acceleration in virtualized environments (HVF error: HV_UNSUPPORTED)
  // I didn't find any way to turn this acceleration off
  // GitHub issues related to this topic:
  // https://github.com/ReactiveCircus/android-emulator-runner/issues/350
  // https://github.com/utmapp/UTM/issues/6821
  // android tests can be run on a local machine with android studio installed
  isAndroid: process.env.IS_ANDROID === "true",
};
