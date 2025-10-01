import { ElementHelperService } from "./helperServices.js";
import { Key } from "vscode-extension-tester";
import RadonViewsService from "./radonViewsService.js";

export default class RadonSettingsService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
    this.radonViewsService = new RadonViewsService(driver);
  }

  async setShowTouches(value = true) {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    const switchElement =
      await this.elementHelperService.findAndWaitForElementByTag(
        "device-settings-show-touches-switch"
      );
    const switchElementState =
      (await switchElement.getAttribute("data-state")) == "checked";

    if (value !== switchElementState) {
      switchElement.click();
    }
    this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }

  async setEnableReplays(value = true) {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    const switchElement =
      await this.elementHelperService.findAndWaitForElementByTag(
        "device-settings-enable-replays-switch"
      );
    const switchElementState =
      (await switchElement.getAttribute("data-state")) == "checked";

    if (value !== switchElementState) {
      switchElement.click();
    }
    this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }

  async rotateDevice(rotation) {
    this.radonViewsService.openRadonDeviceSettingsMenu();
    await this.elementHelperService.findAndClickElementByTag(
      "device-settings-rotate-device-menu-trigger"
    );

    // this menu shows up on hover, normal click does not work because menu disappears before click happens
    const rotationButton =
      await this.elementHelperService.findAndWaitForElementByTag(
        `device-settings-set-orientation-${rotation}`
      );
    await this.driver.executeScript("arguments[0].click();", rotationButton);

    // rotation animation
    await this.driver.sleep(500);
  }
}
