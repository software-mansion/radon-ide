import {
  findAndClickElementByTag,
  findAndWaitForElementByTag,
} from "../utils/helpers.js";
import { openRadonIDEPanel, openRadonSettingsMenu } from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("Main interface buttons tests", () => {
  const get = sharedTestLifecycle();
  let driver;

  beforeEach(async function () {
    ({ driver } = get());
    await openRadonIDEPanel(driver);
  });

  it("Should open device settings window", async function () {
    await findAndClickElementByTag(driver, "device-settings-button");

    await findAndWaitForElementByTag(driver, "device-settings-menu");
  });

  it("Should open radon settings window", async function () {
    await openRadonSettingsMenu(driver);

    await findAndWaitForElementByTag(driver, "radon-settings-menu");
  });

  it("Should open diagnostics window", async function () {
    await openRadonSettingsMenu(driver);
    await findAndClickElementByTag(driver, "run-diagnostics-button");

    await findAndWaitForElementByTag(driver, "diagnostics-view");
  });

  it("Should open manage devices window", async function () {
    const { driver } = get();
    await openRadonSettingsMenu(driver);
    await findAndClickElementByTag(driver, "manage-devices-button");
    await findAndWaitForElementByTag(driver, "manage-devices-view");
  });

  it("Should open send feedback window", async function () {
    await openRadonSettingsMenu(driver);
    await findAndClickElementByTag(driver, "send-feedback-button");
    await findAndWaitForElementByTag(driver, "feedback-view");
  });

  it("Should open radon tools window", async function () {
    await findAndClickElementByTag(driver, "radon-tools-button");

    await findAndWaitForElementByTag(driver, "radon-tools-menu");
  });

  it("Should open radon activate license window", async function () {
    const { driver } = get();
    await findAndClickElementByTag(driver, "activate-license-button");

    await findAndWaitForElementByTag(driver, "activate-license-window");
  });

  it("Should open radon select device menu", async function () {
    await findAndClickElementByTag(driver, "device-select-trigger");

    await findAndWaitForElementByTag(driver, "device-select-content");
  });

  it("Should open radon select approot menu", async function () {
    await findAndClickElementByTag(driver, "approot-select-trigger");

    await findAndWaitForElementByTag(driver, "approot-select-content");
  });
});
