import * as path from "path";
import { fileURLToPath } from "url";
import { By, until } from "vscode-extension-tester";
import { waitForElement } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function openProjectInVSCode(
  browser,
  driver,
  projectPath,
  workbench
) {
  await workbench.executeCommand("View: close all editors");
  await browser.openResources(
    path.resolve(__dirname, projectPath),

    async () => {
      await driver.wait(
        until.elementLocated(By.css("div#swmansion\\.react-native-ide")),
        10000,
        "Timed out waiting for Radon IDE statusbar item"
      );
    }
  );
}

export async function openRadonIDEPanel(browser, driver, workbench) {
  await workbench.executeCommand("RNIDE.openPanel");
  const webview = await driver.wait(
    until.elementLocated(By.css('iframe[class*="webview"]')),
    10000,
    "Timed out waiting for Radon IDE webview"
  );
  await waitForElement(driver, webview);
  await driver.switchTo().frame(webview);

  const iframe = await driver.wait(
    until.elementLocated(By.css('iframe[title="Radon IDE"]')),
    10000,
    "Timed out waiting for Radon IDE iframe"
  );
  await waitForElement(driver, iframe);
  await driver.switchTo().frame(iframe);
}
