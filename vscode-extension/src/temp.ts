import { checkSdkManagerInstalled } from "./utilities/hostDependenciesChecks";
import { getAndroidSystemImages, installSystemImages } from "./utilities/sdkmanager";
(async () => {
  try {
    // await installSystemImage("system-images;android-34;google_apis;arm64-v8a", (line) =>
    //   console.log("LINE NEW: ", line)
    // );
    // const a = await getInstalledAndroidSystemImages();
    const a = await installSystemImages(['system-images;android-24;google_apis;arm64-v8a']);
    console.log(a);
  } catch (e) {
    console.error(e);
  }
})();
