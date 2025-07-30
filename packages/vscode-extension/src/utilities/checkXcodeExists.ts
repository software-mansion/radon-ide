import { testCommand } from "./testCommand";

export async function checkXcodeExists() {
  const isXcodebuildInstalled = await testCommand("xcodebuild -version");
  const isXcrunInstalled = await testCommand("xcrun --version");
  const isSimctlInstalled = await testCommand("xcrun simctl help");
  return isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;
}
