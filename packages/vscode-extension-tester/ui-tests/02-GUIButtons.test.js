import { By } from "vscode-extension-tester";
import { findAndWaitForElement } from "../utils/helpers.js";
import { openRadonIDEPanel, openRadonSettingsMenu } from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("Main interface buttons tests", () => {
  const get = sharedTestLifecycle();

  beforeEach(async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
  });

  it("Should open device settings window", async function () {
    const { driver } = get();
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
    await openRadonSettingsMenu(driver);
    const radonSettingsModal = await findAndWaitForElement(
      driver,
      By.css('[data-test="radon-settings-menu"]'),
      "Timed out waiting for 'Radon settings' menu"
    );
  });

  it("Should open diagnostics window", async function () {
    const { driver } = get();
    await openRadonSettingsMenu(driver);
    const diagnosticsButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="run-diagnostics-button"]'),
      "Timed out waiting for 'Run Diagnostics' button"
    );
    await diagnosticsButton.click();
    const diagnosticsView = await findAndWaitForElement(
      driver,
      By.css('[data-test="diagnostics-view"]'),
      "Timed out waiting for 'Diagnostics view' element"
    );
  });

  it("Should open manage devices window", async function () {
    const { driver } = get();
    await openRadonSettingsMenu(driver);
    const manageDevicesButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="manage-devices-button"]'),
      "Timed out waiting for 'Manage devices' button"
    );
    await manageDevicesButton.click();
    const manageDevicesView = await findAndWaitForElement(
      driver,
      By.css('[data-test="manage-devices-view"]'),
      "Timed out waiting for 'Manage devices view' element"
    );
  });

  it("Should open send feedback window", async function () {
    const { driver } = get();
    await openRadonSettingsMenu(driver);
    const sendFeedbackButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="send-feedback-button"]'),
      "Timed out waiting for 'Send feedback' button"
    );
    await sendFeedbackButton.click();
    const sendFeedbackView = await findAndWaitForElement(
      driver,
      By.css('[data-test="feedback-view"]'),
      "Timed out waiting for 'Feedback view' element"
    );
  });

  it("Should open radon tools window", async function () {
    const { driver } = get();
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
    const approotSelectButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="approot-select-trigger"]'),
      "Timed out waiting for 'Select approot button' element"
    );
    approotSelectButton.click();
    const approotSelectMenu = await findAndWaitForElement(
      driver,
      By.css('[data-test="approot-select-content"]'),
      "Timed out waiting for 'Select approot menu' element"
    );
  });
});
