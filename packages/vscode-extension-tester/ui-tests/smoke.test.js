import { assert } from "chai";
import { VSBrowser, Workbench, By, WebView, EditorView } from "vscode-extension-tester";
import { paths, texts } from "../data/testData.js";
import { openProject } from "../utils/projectLauncher.js";
import { waitForElement } from "../utils/helpers.js";

describe("Smoke tests Radon IDE", () => {
    let browser;
    let driver;
    let workbench;
    let view;
    let isSmokeFailed = false;

    beforeEach(async function () {
        if (isSmokeFailed) {
            this.skip();
        }

        console.log("Initializing VSBrowser...");
        browser = VSBrowser.instance;
        if (!browser) {
            console.error("Failed to initialize VSBrowser.");
            return;
        }
        driver = browser.driver;
        if (!driver) {
            console.error("Failed to obtain driver from VSBrowser.");
            return;
        }

        await browser.waitForWorkbench();

        workbench = new Workbench();
        await new Promise((resolve) => setTimeout(resolve, 500));

        view = new WebView();
    });

    afterEach(async function () {
        await view.switchBack();
        await new EditorView().closeAllEditors();
    });

    it("should open Radon IDE webview", async function () {
        try {
            await openProject(browser, driver, paths.projectPath, workbench);
        } catch (error) {
            isSmokeFailed = true;
            throw error;
        }
    });

    it("should open Radon IDE webview for a specific project", async function () {
        await openProject(browser, driver, paths.projectPath, workbench);

        const title = await driver.getTitle();
        assert.equal(title, 'Radon IDE — ' + texts.pageTitle, `Page title should be: ${texts.pageTitle}`);

        const approot = await driver.findElement(By.css('[data-test="approot-select-value"]'));
        await waitForElement(driver, approot);

        const text = await approot.getText();
        assert.equal(text, texts.expectedProjectName, "Text of the element should be a name of the project");
    });

    it("should the correct context be displayed based on the availability of devices after opening a project", async function () {
        await openProject(browser, driver, paths.projectPath, workbench);

        const deviceSelect = await driver.findElement(By.css('[data-test="device-select-value-text"]')   );
        await waitForElement(driver, deviceSelect);
        const text = await deviceSelect.getText();

        if (text === "No devices found") {
            console.log("No devices found");
            const missingDevice = await driver.findElement(By.css('[data-test="devices-not-found-container"]'));
            assert.isTrue(await missingDevice.isDisplayed(), "Devices not found container should be displayed");

            const deviceNotFoundSubtitle = await driver.findElement(By.css('[data-test="devices-not-found-subtitle"]'));
            const text = await deviceNotFoundSubtitle.getText();
            assert.include(text, "You can add a new device using the quick action below.", "Text should be 'You can add a new device using the quick action below.'");
        } else if (text === "Select device") {
            console.log("Devices are available, but none is selected");
            const deviceNotFound = await driver.findElement(By.css('[data-test="devices-not-found-container"]'));
            assert.isTrue(await deviceNotFound.isDisplayed(), "Devices not found container should be displayed");

            const deviceNotFoundSubtitle = await driver.findElement(By.css('[data-test="devices-not-found-subtitle"]'));
            const text = await deviceNotFoundSubtitle.getText();
            assert.include(text, "You can select one of available devices or create a new one to start.", "Text should be 'You can select one of available devices or create a new one to start.'");
        } else {
            console.log("Some device is selected");
            const phoneWrapper = await driver.findElement(By.css('[data-test="phone-wrapper"]'));
            assert.isTrue(await phoneWrapper.isDisplayed(), "Phone wrapper should be displayed when a device is selected");
        }
    })

});
