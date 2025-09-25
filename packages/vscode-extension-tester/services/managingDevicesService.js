import { ElementHelperService } from "./helperServices.js";
import { By, Key, WebView, EditorView } from "vscode-extension-tester";
import getConfiguration from "../configuration.js";
import RadonViewsService from "./radonViewsService.js";

export default class ManagingDevicesService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
    this.radonViewsService = new RadonViewsService(driver);
  }

  async openDeviceCreationModal() {
    const dropdownButton =
      await this.elementHelperService.findAndWaitForElementByTag(
        "radon-bottom-bar-device-select-dropdown-trigger"
      );

    await this.driver.wait(async () => {
      return await dropdownButton.isEnabled();
    });

    dropdownButton.click();

    await this.elementHelperService.findAndClickElementByTag(
      "device-select-menu-manage-devices-button"
    );

    await this.elementHelperService.findAndClickElementByTag(
      "manage-devices-menu-create-new-device-button"
    );
  }

  async fillDeviceCreationForm(deviceName) {
    await this.elementHelperService.findAndClickElementByTag(
      "creating-device-form-device-type-select"
    );

    const { IS_ANDROID, IS_GITHUB_ACTIONS } = getConfiguration();
    let device = IS_ANDROID ? "pixel" : "com.apple";
    device = IS_GITHUB_ACTIONS
      ? "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro"
      : device;
    let systemImage = IS_GITHUB_ACTIONS
      ? "com.apple.CoreSimulator.SimRuntime.iOS-18-5"
      : "";

    const selectedDevice =
      await this.elementHelperService.findAndWaitForElement(
        By.css(
          `[data-testid^="creating-device-form-device-type-select-item-${device}"]`
        ),
        "Timed out waiting for an element matching from devices list"
      );
    await selectedDevice.click();

    await this.elementHelperService.findAndClickElementByTag(
      "creating-device-form-system-image-select"
    );

    const selectedSystemImage =
      await this.elementHelperService.findAndWaitForElement(
        By.css(
          `[data-testid^="creating-device-form-system-image-select-item-${systemImage}"]:not(.select-item-marked)`
        ),
        "Timed out waiting for an element matching from system image list"
      );
    await selectedSystemImage.click();

    const deviceNameInput =
      await this.elementHelperService.findAndWaitForElement(
        By.css('[data-testid="creating-device-form-name-input"]'),
        "Timed out waiting for an element matching from system image list"
      );

    // this method of clearing input seems to be most reliable
    deviceNameInput.click();
    await deviceNameInput.sendKeys(Key.chord(Key.COMMAND, "a"));
    await deviceNameInput.sendKeys(Key.BACK_SPACE);
    await this.driver.wait(async () => {
      const value = await deviceNameInput.getAttribute("value");
      return value === "";
    }, 3000);
    await deviceNameInput.sendKeys(deviceName);
  }

  async addNewDevice(newDeviceName) {
    await this.openDeviceCreationModal();
    await this.fillDeviceCreationForm(newDeviceName);

    await this.elementHelperService.findAndClickElementByTag(
      "creating-device-form-confirmation-button"
    );
  }

  async deleteDevice(deviceName) {
    await this.elementHelperService.findAndClickElementByTag(
      `manage-devices-menu-delete-button-device-${deviceName}`
    );

    await this.elementHelperService.findAndClickElementByTag(
      `confirm-delete-device-button`
    );
  }
  async deleteAllDevices() {
    await this.radonViewsService.openRadonIDEPanel();
    await this.elementHelperService.findAndClickElementByTag(
      `radon-bottom-bar-device-select-dropdown-trigger`
    );
    await this.elementHelperService.findAndClickElementByTag(
      `device-select-menu-manage-devices-button`
    );

    try {
      while (true) {
        const deviceDeleteButton =
          await this.elementHelperService.findAndWaitForElement(
            By.css(
              `[data-testid^="manage-devices-menu-delete-button-device-"]`
            ),
            "Timed out waiting for device delete button",
            5000
          );
        await deviceDeleteButton.click();
        await this.elementHelperService.findAndClickElementByTag(
          `confirm-delete-device-button`
        );

        await this.elementHelperService.waitUntilElementGone(
          By.css(`[data-testid="device-removing-confirmation-view"]`),
          // deleting device on GitHub CI takes a lot of time for some reason
          20000,
          "delete confirmation modal did not disappear"
        );
      }
    } catch (e) {}
    this.elementHelperService.findAndClickElementByTag(`modal-close-button`);
    const view = new WebView();
    await view.switchBack();
    await new EditorView().closeAllEditors();
    await this.radonViewsService.openRadonIDEPanel();
  }

  async modifyDeviceName(deviceName, modifiedDeviceName) {
    await this.elementHelperService.findAndClickElementByTag(
      `manage-devices-menu-rename-button-device-${deviceName}`
    );

    const deviceNameInput =
      await this.elementHelperService.findAndWaitForElement(
        By.css('[data-testid="renaming-device-view-input"]'),
        "Timed out waiting for device name input"
      );

    deviceNameInput.click();
    await deviceNameInput.sendKeys(Key.chord(Key.COMMAND, "a"), Key.BACK_SPACE);
    deviceNameInput.clear();
    await this.driver.wait(async () => {
      return (await deviceNameInput.getAttribute("value")) === "";
    });
    await deviceNameInput.sendKeys(modifiedDeviceName);

    await this.elementHelperService.findAndClickElementByTag(
      `renaming-device-view-save-button`
    );
  }
}
