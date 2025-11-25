import { execSync } from "child_process";
import * as fs from "fs";
import { assert } from "chai";
import { WebView, By, Key } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { getAppWebsocket } from "../server/webSocketServer.js";
import { itIf } from "../utils/helpers.js";
import getConfiguration from "../configuration.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

const rotationSequence = "1010110010101110010010111011100100100111";

const raw = fs.readFileSync("./data/react-native-app/package.json");
const data = JSON.parse(raw);
const IS_APP_WITH_ADDITIONAL_LIBS = data.name.includes("AdditionalLibs");

safeDescribe("8 - Device Settings", () => {
  let driver,
    appWebsocket,
    view,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService;

  before(async () => {
    ({ driver, view } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
      radonSettingsService,
    } = initServices(driver));

    await managingDevicesService.prepareDevices();

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    await appManipulationService.hideExpoOverlay(appWebsocket);
  });

  afterEach(async () => {
    // leave device in portrait mode
    await radonSettingsService.rotateDevice("portrait");
  });

  it("should toggle device frame", async () => {
    await elementHelperService.findAndWaitForElementByTag("device-frame");

    radonViewsService.openRadonDeviceSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "device-settings-show-device-frame-switch"
    );
    driver.actions().sendKeys(Key.ESCAPE).perform();

    await elementHelperService.waitUntilElementGone(
      By.css("[data-testid='device-frame']")
    );

    radonViewsService.openRadonDeviceSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "device-settings-show-device-frame-switch"
    );
    driver.actions().sendKeys(Key.ESCAPE).perform();

    await elementHelperService.findAndWaitForElementByTag("device-frame");
  });

  it("should rotate device", async () => {
    await radonSettingsService.rotateDevice("landscape-left");

    await driver.wait(async () => {
      const orientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );
      return orientation.value === "landscape";
    }, 5000);

    await radonSettingsService.rotateDevice("portrait");

    await driver.wait(async () => {
      const orientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );
      return orientation.value === "portrait";
    }, 5000);

    // rotation does not work without this sleep
    await driver.sleep(1000);

    await radonSettingsService.rotateDevice("clockwise");

    await driver.wait(async () => {
      const orientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );
      return orientation.value === "landscape";
    }, 5000);

    await radonSettingsService.rotateDevice("anticlockwise");

    await driver.wait(async () => {
      const orientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );
      return orientation.value === "portrait";
    }, 5000);
  });

  it("should rotate device using shortcuts", async () => {
    // there is no Key.OPTION in selenium and Key.ALT does not work as expected on Mac
    // so we use custom script to dispatch keyboard event, instead of standard selenium way
    await driver.executeScript(`
        const evt = new KeyboardEvent('keydown', {
          key: '9',
          code: 'Digit9',
          altKey: true,
          ctrlKey: true,
          bubbles: true
        });
        document.dispatchEvent(evt);
      `);

    await driver.wait(async () => {
      const orientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );
      return orientation.value === "landscape";
    }, 5000);

    await driver.executeScript(`
        const evt = new KeyboardEvent('keydown', {
          key: '0',
          code: 'Digit0',
          altKey: true,
          ctrlKey: true,
          bubbles: true
        });
        document.dispatchEvent(evt);
      `);

    await driver.wait(async () => {
      const orientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );
      return orientation.value === "portrait";
    }, 5000);
  });

  it("should stay stable after rapid rotations", async () => {
    for (let i of rotationSequence) {
      if (i === "1")
        await driver.executeScript(`
        const evt = new KeyboardEvent('keydown', {
          key: '9',
          code: 'Digit9',
          altKey: true,
          ctrlKey: true,
          bubbles: true
        });
        document.dispatchEvent(evt);
        `);
      else
        await driver.executeScript(`
        const evt = new KeyboardEvent('keydown', {
          key: '0',
          code: 'Digit0',
          altKey: true,
          ctrlKey: true,
          bubbles: true
        });
        document.dispatchEvent(evt);
      `);
      // some delay for rotations not to be to fast
      await driver.sleep(100);
    }

    const start = Date.now();
    const firstOrientation =
      await appManipulationService.sendMessageAndWaitForResponse(
        appWebsocket,
        "getOrientation"
      );

    let changes = 0;

    // checks for 2 seconds if device orientation does not change
    while (Date.now() - start < 2000) {
      const currentOrientation =
        await appManipulationService.sendMessageAndWaitForResponse(
          appWebsocket,
          "getOrientation"
        );

      if (firstOrientation.value !== currentOrientation.value) {
        changes++;
        firstOrientation.value = currentOrientation.value;
      }

      // the rotation might be delayed so one change is acceptable
      if (changes > 1) {
        throw new Error("Device orientation changed more than once");
      }

      await new Promise((r) => setTimeout(r, 100));
    }
  });

  it("should change device font size", async () => {
    async function waitForFontSizeChange(fontSize) {
      return await driver.wait(async () => {
        let newFontSize =
          await appManipulationService.sendMessageAndWaitForResponse(
            getAppWebsocket(),
            "getFontSize"
          );
        if (fontSize.value !== newFontSize.value) {
          return newFontSize;
        }
        return false;
      }, 5000);
    }

    await radonViewsService.openRadonDeviceSettingsMenu();
    let fontSize = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getFontSize"
    );
    await elementHelperService.findAndClickElementByTag(
      `device-settings-font-size-slider-track-dent-0`
    );

    fontSize = await waitForFontSizeChange(fontSize);

    for (let i = 1; i < 7; i++) {
      await elementHelperService.findAndClickElementByTag(
        `device-settings-font-size-slider-track-dent-${i}`
      );
      fontSize = await waitForFontSizeChange(fontSize);
    }
  });

  it("should change device appearance mode", async () => {
    await radonViewsService.openRadonDeviceSettingsMenu();

    await elementHelperService.findAndClickElementByTag(
      "device-appearance-light"
    );
    await driver.wait(async () => {
      const appearance =
        await appManipulationService.sendMessageAndWaitForResponse(
          getAppWebsocket(),
          "getColorScheme"
        );
      return appearance.value === "light";
    }, 5000);

    await elementHelperService.findAndClickElementByTag(
      "device-appearance-dark"
    );
    await driver.wait(async () => {
      const appearance =
        await appManipulationService.sendMessageAndWaitForResponse(
          getAppWebsocket(),
          "getColorScheme"
        );
      return appearance.value === "dark";
    }, 5000);
  });

  itIf(
    !getConfiguration().IS_ANDROID,
    "should open app switcher in simulator",
    async () => {
      radonViewsService.openRadonDeviceSettingsMenu();
      await elementHelperService.findAndClickElementByTag(
        "open-app-switcher-button"
      );

      await driver.wait(async () => {
        const appState =
          await appManipulationService.sendMessageAndWaitForResponse(
            getAppWebsocket(),
            "getAppState"
          );
        // this test works on iOS only, Android app's state stays active in app switcher
        return appState.value === "inactive";
      }, 5000);
    }
  );

  it("should press home button in simulator", async () => {
    radonViewsService.openRadonDeviceSettingsMenu();
    await elementHelperService.findAndClickElementByTag("press-home-button");

    await driver.wait(async () => {
      const appState =
        await appManipulationService.sendMessageAndWaitForResponse(
          getAppWebsocket(),
          "getAppState"
        );
      return appState.value === "background";
    }, 5000);
  });

  itIf(
    !getConfiguration().IS_ANDROID && IS_APP_WITH_ADDITIONAL_LIBS,
    "change location",
    async () => {
      execSync(
        "xcrun simctl --set ~/Library/Caches/com.swmansion.radon-ide/Devices/iOS privacy booted grant location org.reactjs.native.example.reactNative81AdditionalLibs"
      );

      await appManipulationService.restartDevice();
      await appManipulationService.waitForAppToLoad();

      await driver.sleep(3000);
      await driver.wait(async () => {
        appWebsocket = get().appWebsocket;
        return appWebsocket != null;
      }, 5000);

      await appManipulationService.hideExpoOverlay(appWebsocket);

      const locationsToTest = [
        { lattitude: 1, longitude: 1 },
        { lattitude: 0, longitude: 0 },
        { lattitude: -1, longitude: -1 },
      ];
      for (const actualLocation of locationsToTest) {
        radonViewsService.openRadonDeviceSettingsMenu();
        await elementHelperService.findAndClickElementByTag(
          "device-settings-location"
        );
        const locationInput =
          await elementHelperService.findAndWaitForElementByTag(
            "coordinates-input"
          );
        await locationInput.clear();
        await driver.sleep(1000);
        await locationInput.sendKeys(
          `${actualLocation.lattitude} ${actualLocation.longitude}`,
          Key.ENTER
        );

        await elementHelperService.findAndClickElementByTag(
          "modal-close-button"
        );
        await driver.wait(async () => {
          try {
            const location =
              await appManipulationService.sendMessageAndWaitForResponse(
                appWebsocket,
                "getLocation"
              );
            assert.approximately(
              location.value.latitude,
              actualLocation.lattitude,
              0.1
            );
            assert.approximately(
              location.value.longitude,
              actualLocation.longitude,
              0.1
            );
            return true;
          } catch {
            return false;
          }
        }, 10000);
      }
    }
  );

  itIf(
    !getConfiguration().IS_ANDROID && IS_APP_WITH_ADDITIONAL_LIBS,
    "change location",
    async () => {
      radonViewsService.openRadonDeviceSettingsMenu();
      await elementHelperService.findAndClickElementByTag(
        "device-settings-localization"
      );
      const input = await elementHelperService.findAndClickElementByTag(
        "localization-search-input"
      );
      await input.sendKeys("Spanish", Key.ENTER);
      await elementHelperService.findAndClickElementByTag(
        "localization-tile-es_es"
      );
      await elementHelperService.findAndClickElementByTag(
        "confirm-localization-change-button"
      );

      await elementHelperService.findAndWaitForElementByTag("startup-message");

      await appManipulationService.waitForAppToLoad();

      await driver.wait(async () => {
        appWebsocket = get().appWebsocket;
        return appWebsocket != null;
      }, 5000);

      await driver.wait(async () => {
        try {
          const localization =
            await appManipulationService.sendMessageAndWaitForResponse(
              appWebsocket,
              "getLocalization"
            );
          assert.equal(localization.value.countryCode.toLowerCase(), "es");
          assert.equal(localization.value.languageTag.toLowerCase(), "es-es");
          assert.equal(localization.value.languageCode.toLowerCase(), "es");
          return true;
        } catch {
          return false;
        }
      }, 10000);
    }
  );
});
