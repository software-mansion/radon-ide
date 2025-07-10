import * as path from "path";
import { fileURLToPath } from 'url';
import { By } from "vscode-extension-tester";
import { waitForElement } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function openProject(browser, driver, projectPath, workbench) {
    await browser.openResources(
        path.resolve(__dirname, projectPath),

        async () => {
            console.log('Additional wait after workbench is ready');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    );

    await workbench.executeCommand('RNIDE.openPanel');
    await driver.sleep(1000);

    const webview = await driver.findElement(By.css('iframe[class*="webview"]'));
    await waitForElement(driver, webview);
    await driver.switchTo().frame(webview);

    const iframe = await driver.findElement(By.css('iframe[title="Radon IDE"]'));
    await waitForElement(driver, iframe);
    await driver.switchTo().frame(iframe);

    const panelView = await driver.findElement(By.css('[data-test="radon-panel-view"]'));
    await waitForElement(driver, panelView);
}

export { openProject };
