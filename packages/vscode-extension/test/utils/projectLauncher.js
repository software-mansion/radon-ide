import * as path from "path";
import { fileURLToPath } from 'url';
import { By } from "vscode-extension-tester";

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
    await driver.sleep(5000);

    const webview = await driver.findElement(By.className('webview'));
    await driver.switchTo().frame(webview);

    const iframe = await workbench.getDriver().findElement(By.tagName('iframe'));
    await workbench.getDriver().switchTo().frame(iframe);
}

export { openProject };