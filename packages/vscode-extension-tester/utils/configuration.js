export default {
  isRecording: false,

  // Android devices does not work on github actions macos runners nor local macos vms
  // it's possibly caused by lack of support for hardware acceleration in virtualized environments (HVF error: HV_UNSUPPORTED)
  // I didn't found any way to turn this acceleration off
  // GitHub issues related to this topic:
  // https://github.com/ReactiveCircus/android-emulator-runner/issues/350
  // https://github.com/utmapp/UTM/issues/6821
  // android tests can be run on local machine with android studio installed
  isAndroid: false,
};
