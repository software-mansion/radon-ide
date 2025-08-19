import { By } from "vscode-extension-tester";
import {
  findAndWaitForElement,
  findAndClickElementByTag,
} from "../utils/helpers.js";
import { openRadonIDEPanel } from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("screenshots panel tests", () => {
  const get = sharedTestLifecycle();

  it("Should take a screenshot", async () => {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    await findAndWaitForElement(
      driver,
      By.css(`[data-test="phone-screen"]`),
      "Timed out waiting for phone-screen",
      600000
    );
    await findAndClickElementByTag(driver, "capture-screenshot-button");
  });
});
