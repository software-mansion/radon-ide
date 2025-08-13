import { By } from "vscode-extension-tester";
import {
  findAndClickElementByTag,
  findAndWaitForElementByTag,
  findAndWaitForElement,
} from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  addNewDevice,
  modifyDeviceName,
  deleteDevice,
  deleteAllDevices,
} from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";
import { WebviewView } from "vscode-extension-tester";

describe("Adding device tests", () => {
  const get = sharedTestLifecycle();

  it("Should start building the app", async () => {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    await addNewDevice(driver, "device1");
    await findAndClickElementByTag(driver, "modal-close-button");
    await findAndWaitForElement(
      driver,
      By.css(`[data-test="phone-screen"]`),
      "Timed out waiting for phone-screen",
      600000
    );
    await findAndClickElementByTag(driver, "radon-tools-button");
    await findAndWaitForElementByTag(driver, "radon-tools-menu");
    await findAndClickElementByTag(driver, "dev-tool-Network");
    await driver.sleep(5000);
    const webviewView = new WebviewView();
    console.log(webviewView);
  });
});
