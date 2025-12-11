import { Key } from "vscode-extension-tester";
import { TIMEOUTS } from "../utils/timeouts.js";
import { ElementHelperService } from "./helperServices.js";
import RadonViewsService from "./radonViewsService.js";

export default class RadonSettingsService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
    this.radonViewsService = new RadonViewsService(driver);
  }

  async setShowTouches(value = true) {
    await this._toggleSetting("device-settings-show-touches-switch", value);
  }

  async setEnableReplays(value = true) {
    await this._toggleSetting("device-settings-enable-replays-switch", value);
  }

  async _toggleSetting(switchTag, targetValue) {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    const switchElement =
      await this.elementHelperService.findAndWaitForElementByTag(switchTag);

    const isChecked =
      (await switchElement.getAttribute("data-state")) === "checked";

    if (targetValue !== isChecked) {
      await switchElement.click();
    }

    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }

  async rotateDevice(rotation) {
    this.radonViewsService.openRadonDeviceSettingsMenu();
    await this.elementHelperService.findAndClickElementByTag(
      "device-settings-rotate-device-menu-trigger"
    );

    // This menu shows up on hover, a normal click does not work because the menu disappears before the click happens
    const rotationButton =
      await this.elementHelperService.findAndWaitForElementByTag(
        `device-settings-set-orientation-${rotation}`
      );

    await this.driver.executeScript("arguments[0].click();", rotationButton);

    // Rotation animation
    await this.driver.sleep(TIMEOUTS.SHORT);
  }
}
