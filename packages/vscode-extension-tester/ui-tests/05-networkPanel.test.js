import { By } from "vscode-extension-tester";
import {
  findAndClickElementByTag,
  findAndWaitForElementByTag,
  findAndWaitForElement,
} from "../utils/helpers.js";
import { openRadonIDEPanel, findWebViewIFrame } from "./interactions.js";
import { get } from "./setupTest.js";

describe("Network panel tests", () => {
  const { driver } = get();

  it("Should open the network panel", async () => {
    await openRadonIDEPanel(driver);
    await findAndWaitForElement(
      driver,
      By.css(`[data-test="phone-screen"]`),
      "Timed out waiting for phone-screen",
      600000
    );
    await findAndClickElementByTag(driver, "radon-tools-button");
    await findAndWaitForElementByTag(driver, "radon-tools-menu");
    await findAndClickElementByTag(driver, "dev-tool-Network");
    await driver.sleep(1000);
    const networkIFrame = await findWebViewIFrame(
      driver,
      "Radon Network Inspector"
    );
    driver.switchTo().frame(networkIFrame);
  });
});
