import { By, VSBrowser } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { exec } from "child_process";

describe("11 - App switching tests", () => {
  let driver,
    appWebsocket,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService;

  before(async () => {
    ({ driver } = get());
    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    try {
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
    } catch {}
  });

  function execAsync(command) {
    return new Promise((resolve, reject) => {
      exec(command, (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }

  it("should change apps", async () => {
    await execAsync("./scripts/downloadRepo.sh test-app react-native-app2");
    const browser = VSBrowser.instance;
    browser.openResources(`./data`);
    await driver.switchTo().defaultContent();
    await driver.wait(async () => {
      try {
        await radonViewsService.openRadonIDEPanel();
      } catch {
        return false;
      }
      return true;
    });

    await appManipulationService.waitForAppToLoad();
    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-dropdown-content"
    );
    let projects = await driver.findElements(
      By.css(`[data-testid^="approot-select-item-"]`)
    );

    await projects[0].click();
    await appManipulationService.waitForAppToLoad();

    const approot = await elementHelperService.findAndWaitForElement(
      By.css('[data-testid="approot-select-value"]')
    );

    const actualAppName1 = await approot.getText();
    const appName1 = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getAppName"
    );
    assert.equal(appName1.value, actualAppName1);

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-dropdown-content"
    );
    projects = await driver.findElements(
      By.css(`[data-testid^="approot-select-item-"]`)
    );
    for (let project of projects) {
      if ((await project.getText()).includes("testApp")) {
        await project.click();
      }
    }

    // this sleep is necessary for project to change
    await driver.sleep(1000);

    await appManipulationService.waitForAppToLoad();
    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
    const actualAppName2 = await approot.getText();
    const appName2 = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getAppName"
    );
    assert.equal(appName2.value, actualAppName2);
  });
});
