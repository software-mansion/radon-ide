import { assert } from "chai";
import { By } from "vscode-extension-tester";
import { texts } from "../data/testData.js";
import { waitForElement, findAndWaitForElement } from "../utils/helpers.js";
import { openRadonIDEPanel } from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("Smoke tests Radon IDE", () => {
  const get = sharedTestLifecycle();

  it("Should open device settings window", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const deviceSettingsButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="device-settings-button"]'),
      "Timed out waiting for 'Device settings' button"
    );
    await deviceSettingsButton.click();
    const deviceSettingsModal = await findAndWaitForElement(
      driver,
      By.css('[data-test="device-settings-menu"]'),
      "Timed out waiting for 'Device settings' menu"
    );
  });

  it("Should open radon settings window", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const radonSettingsButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="radon-settings-button"]'),
      "Timed out waiting for 'Radon settings' button"
    );
    await radonSettingsButton.click();
    const radonSettingsModal = await findAndWaitForElement(
      driver,
      By.css('[data-test="radon-settings-menu"]'),
      "Timed out waiting for 'Radon settings' menu"
    );
  });

  it("Should open radon tools window", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const radonToolsButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="radon-tools-button"]'),
      "Timed out waiting for 'Radon tools' button"
    );
    await radonToolsButton.click();
    const radonToolsModal = await findAndWaitForElement(
      driver,
      By.css('[data-test="radon-tools-menu"]'),
      "Timed out waiting for 'Radon tools' menu"
    );
  });

  it("Should open radon activate license window", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const radonActivateLicenseButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="activate-license-button"]'),
      "Timed out waiting for 'Radon activate license' button"
    );
    await radonActivateLicenseButton.click();
    const radonActivateLicenseModal = await findAndWaitForElement(
      driver,
      By.css('[data-test="activate-license-window"]'),
      "Timed out waiting for 'Radon activate license' menu"
    );
  });

  it("Should open radon select device menu", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const deviceSelectButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="device-select-trigger"]'),
      "Timed out waiting for 'Select device button' element"
    );
    deviceSelectButton.click();
    const deviceSelectMenu = await findAndWaitForElement(
      driver,
      By.css('[data-test="device-select-content"]'),
      "Timed out waiting for 'Select device menu' element"
    );
  });

  it("Should open radon select approot menu", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const approotSelectButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="approot-select-trigger"]'),
      "Timed out waiting for 'Select approot button' element"
    );
    approotSelectButton.click();
    const deviceSelectMenu = await findAndWaitForElement(
      driver,
      By.css('[data-test="approot-select-content"]'),
      "Timed out waiting for 'Select approot menu' element"
    );
  });
});
