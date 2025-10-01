import { assert } from "chai";
import {
  By,
  WebView,
  EditorView,
  Key,
  ActivityBar,
} from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { exec } from "child_process";
import getConfiguration from "../configuration.js";

describe("3 - Adding device tests", () => {
  let driver,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService;

  beforeEach(async function () {
    ({ driver } = get());
    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
    } = initServices(driver));
    const view = new WebView();

    await view.switchBack();
    await new EditorView().closeAllEditors();
    await managingDevicesService.deleteAllDevices();
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("should add device to Radon IDE", async function () {
    await radonViewsService.openRadonIDEPanel();
    const newDeviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(newDeviceName);

    await elementHelperService.findAndWaitForElement(
      By.css(
        `[data-testid^="manage-devices-menu-row-device-${newDeviceName}"]`
      ),
      `Timed out waiting for device with name: ${newDeviceName}`,
      20000
    );
  });

  it("should modify device name in Radon IDE", async function () {
    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(deviceName);

    const modifiedDeviceName = `${Date.now()}`;

    await managingDevicesService.modifyDeviceName(
      deviceName,
      modifiedDeviceName
    );

    await elementHelperService.findAndWaitForElement(
      By.css(
        `[data-testid^="manage-devices-menu-row-device-${modifiedDeviceName}"]`
      ),
      `Timed out waiting for device with modified name: ${modifiedDeviceName}`
    );
  });

  it("should delete device from Radon IDE", async function () {
    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;
    let deviceFound = false;

    await managingDevicesService.addNewDevice(deviceName);

    await managingDevicesService.deleteDevice(deviceName);

    const deviceSelectButton = await elementHelperService.findAndWaitForElement(
      By.css('[data-testid="radon-bottom-bar-device-select-dropdown-trigger"]'),
      "Timed out waiting for 'Select device button' element"
    );
    deviceSelectButton.click();

    try {
      await elementHelperService.findAndWaitForElement(
        By.css(`[data-testid^="manage-devices-menu-row-device-${deviceName}"]`),
        `Timed out waiting for device to delete: ${deviceName}`,
        3000
      );
      deviceFound = true;
    } catch (e) {
      deviceFound = false;
    }

    if (deviceFound) {
      throw new Error("Device was not successfully deleted.");
    }
  });

  it("should stop running device", async function () {
    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(deviceName);
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    await elementHelperService.findAndWaitForElementByTag(
      "phone-display-container"
    );
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag("device-select-menu");

    await elementHelperService.findAndWaitForElementByTag(
      `device-${deviceName}`
    );

    await elementHelperService.findAndClickElementByTag("device-running-badge");
    await elementHelperService.waitUntilElementGone(
      By.css(`[data-testid="phone-display-container"]`),
      10000,
      "Timed out waiting for phone screen to disappear"
    );
  });

  it("should kill process after stopping device", async function () {
    function execCommand(command) {
      return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
          if (err) {
            // grep returns exit code 1 if no lines were found, it's not an error in this case
            if (err.code === 1) {
              return resolve({ stdout: "", stderr: "" });
            }
            console.log("exec error: ", err, stderr);
            return reject(err);
          }
          resolve({ stdout, stderr });
        });
      });
    }

    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(deviceName);
    const newDevice = await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid^="manage-devices-menu-row-device-${deviceName}"]`),
      `Timed out waiting for device with name: ${deviceName}`
    );

    const deviceID = (await newDevice.getAttribute("data-testid"))
      .split("--")
      .pop()
      .replace(getConfiguration().IS_ANDROID ? "android-" : "ios-", "");

    await elementHelperService.findAndClickElementByTag("modal-close-button");

    await appManipulationService.waitForAppToLoad();

    console.log("Device ID:", deviceID);

    let { stdout } = await execCommand(
      `ps aux | grep ${deviceID} | grep -v grep`
    );
    assert.isNotEmpty(stdout, `No process found for device ID: ${deviceID}`);

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag("device-select-menu");
    await elementHelperService.findAndWaitForElementByTag(
      `device-${deviceName}`
    );
    await elementHelperService.findAndClickElementByTag("device-running-badge");

    await driver.wait(async () => {
      ({ stdout } = await execCommand(
        `ps aux | grep ${deviceID} | grep -v grep`
      ));
      return stdout == "";
    }, 5000);
  });

  it("should switch between devices using shortcuts", async function () {
    const deviceName1 = "device1";
    const deviceName2 = "device2";
    await radonViewsService.openRadonIDEPanel();
    await managingDevicesService.addNewDevice(deviceName1);
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    await managingDevicesService.addNewDevice(deviceName2);
    await elementHelperService.findAndClickElementByTag(
      `device-row-start-button-device-${deviceName2}`
    );
    const chosenDevice = await elementHelperService.findAndWaitForElementByTag(
      "device-select-value-text"
    );

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName2;
    }, 5000);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("9")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName1;
    }, 5000);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("9")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName2;
    }, 5000);
  });

  it("should change debug session when switching devices", async function () {
    async function checkIfNameInDebugNameChanges(deviceName) {
      await driver.switchTo().defaultContent();

      const btn = await new ActivityBar().getViewControl("Run");
      const debugView = await btn.openView();

      await driver.wait(async () => {
        let label = "";
        try {
          const callStack = await debugView.getCallStackSection();
          const items = await callStack.getVisibleItems();
          const item = await items.at(0);
          label = await item.getLabel();
        } catch (e) {
          return false;
        }
        return label.includes(deviceName);
      }, 5000);
      await radonViewsService.switchToRadonIDEFrame();
    }

    const deviceName1 = "device1";
    const deviceName2 = "device2";
    await radonViewsService.openRadonIDEPanel();
    await managingDevicesService.addNewDevice(deviceName1);
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    await appManipulationService.waitForAppToLoad();

    await managingDevicesService.addNewDevice(deviceName2);
    await elementHelperService.findAndClickElementByTag(
      `device-row-start-button-device-${deviceName2}`
    );
    const chosenDevice = await elementHelperService.findAndWaitForElementByTag(
      "device-select-value-text"
    );

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName2;
    }, 5000);
    
    await appManipulationService.waitForAppToLoad();
    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("9")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName1;
    }, 5000);

    await appManipulationService.waitForAppToLoad();

    await checkIfNameInDebugNameChanges(deviceName1);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("9")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await checkIfNameInDebugNameChanges(deviceName2);
  });
});
