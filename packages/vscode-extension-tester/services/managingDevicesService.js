import { By, Key, WebView, EditorView } from "vscode-extension-tester";
import getConfiguration from "../configuration.js";
import { TIMEOUTS } from "../utils/timeouts.js";
import { ElementHelperService } from "./helperServices.js";
import RadonViewsService from "./radonViewsService.js";
import { resetAppWebsocket } from "../server/webSocketServer.js";

// Determine modifier key (Command for Mac, Control for Windows/Linux)
const MODIFIER_KEY = Key.COMMAND;

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

    await dropdownButton.click();

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
    if (IS_GITHUB_ACTIONS) {
      device = "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro";
    }

    const systemImage = IS_GITHUB_ACTIONS
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
        "Timed out waiting for the device name input element"
      );

    // This method of clearing input seems to be most reliable
    await deviceNameInput.click();
    await deviceNameInput.sendKeys(Key.chord(MODIFIER_KEY, "a"));
    await deviceNameInput.sendKeys(Key.BACK_SPACE);

    await this.driver.wait(async () => {
      const value = await deviceNameInput.getAttribute("value");
      return value === "";
    }, TIMEOUTS.ANDROID_OVERLAY);

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
      "confirm-delete-device-button"
    );
  }

  async deleteAllDevices() {
    await this.radonViewsService.openRadonIDEPanel();
    try {
      await this.elementHelperService.findAndClickElementByTag(
        "radon-bottom-bar-device-select-dropdown-trigger"
      );
      await this.elementHelperService.findAndClickElementByTag(
        "device-select-menu-manage-devices-button"
      );
    } catch (error) {
      // this step is sometimes flaky so we use a retry mechanism
      if (error.name === "StaleElementReferenceError") {
        this.driver.actions().sendKeys(Key.ESCAPE).perform();
        await this.elementHelperService.findAndClickElementByTag(
          "radon-bottom-bar-device-select-dropdown-trigger"
        );
        await this.elementHelperService.findAndClickElementByTag(
          "device-select-menu-manage-devices-button"
        );
      }
    }

    // Loop until no delete buttons are found
    while (true) {
      // Check if any delete button exists without waiting/throwing error
      const deviceDeleteButton = await this.elementHelperService.safeFind(
        By.css('[data-testid^="manage-devices-menu-delete-button-device-"]')
      );

      if (!deviceDeleteButton) {
        break;
      }

      await deviceDeleteButton.click();

      await this.elementHelperService.findAndClickElementByTag(
        "confirm-delete-device-button"
      );

      await this.elementHelperService.waitUntilElementGone(
        By.css('[data-testid="device-removing-confirmation-view"]'),
        // Deleting a device on GitHub CI may take a lot of time for some reason
        TIMEOUTS.LONG,
        "Delete confirmation modal did not disappear"
      );
    }

    try {
      await this.elementHelperService.findAndClickElementByTag(
        "modal-close-button"
      );
    } catch (e) {
      // Ignore if close button is not present/clickable
    }

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

    await deviceNameInput.click();
    await deviceNameInput.sendKeys(
      Key.chord(MODIFIER_KEY, "a"),
      Key.BACK_SPACE
    );

    await this.driver.wait(async () => {
      const value = await deviceNameInput.getAttribute("value");
      return value === "";
    });

    await deviceNameInput.sendKeys(modifiedDeviceName);

    await this.elementHelperService.findAndClickElementByTag(
      "renaming-device-view-save-button"
    );
  }

  async switchToDevice(deviceName) {
    resetAppWebsocket();
    const chosenDevice =
      await this.elementHelperService.findAndWaitForElementByTag(
        "device-select-value-text"
      );

    if ((await chosenDevice.getText()) !== deviceName) {
      await this.elementHelperService.findAndClickElementByTag(
        "radon-bottom-bar-device-select-dropdown-trigger"
      );
      await this.elementHelperService.findAndClickElementByTag(
        `device-${deviceName}`
      );

      await this.driver.wait(
        async () => {
          const currentDevice =
            await this.elementHelperService.findAndWaitForElementByTag(
              "device-select-value-text"
            );
          return deviceName === (await currentDevice.getText());
        },
        TIMEOUTS.MEDIUM,
        "Timed out waiting for device to be switched"
      );
    }
  }

  async prepareDevices(deviceName = "newDevice") {
    await this.deleteAllDevices();
    await this.addNewDevice(deviceName);

    try {
      await this.elementHelperService.findAndClickElementByTag(
        "modal-close-button"
      );
    } catch (e) {
      // Modal might be already closed
    }
  }
}
