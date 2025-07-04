import { assert } from "chai";
import { VSBrowser, Workbench, By, WebView, EditorView } from "vscode-extension-tester";
import { paths, texts } from "../data/testData.js";
import { openProject } from "../utils/projectLauncher.js";

describe("Smoke tests Radon IDE", () => {
    let browser;
    let driver;
    let workbench;
    let view;

    beforeEach(async function () {
        this.timeout(8000);
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
        this.timeout(8000);
        await view.switchBack();
        await new EditorView().closeAllEditors();
    });

    it("should open Radon IDE webview for a specific project", async function () {
        this.timeout(15000);
        const title = await driver.getTitle();
        assert.equal(title, texts.pageTitle, "Page title should be 'Visual Studio Code'");

        await openProject(browser, driver, paths.projectPath, workbench);

        const element = await driver.findElement(By.className('approot-select-value'));
        const isVisible = await element.isDisplayed();
        assert.isTrue(isVisible, "Devices not found container should be visible");

        const text = await element.getText();
        assert.equal(text, texts.expectedProjectName, "Text of the element should be a name of the project");
    });

    it("should the correct context be displayed based on the availability of devices after opening a project", async function () {
        this.timeout(30000);

        await openProject(browser, driver, paths.projectPath, workbench);

        const deviceSelect = await driver.findElement(By.className('device-select-value-text'));
        const text = await deviceSelect.getText();

        if (text === "No devices found") {
            console.log("No devices found");
            const missingDevice = await driver.findElement(By.className('missing-device-filler'));
            assert.isTrue(await missingDevice.isDisplayed(), "Missing device filler should be displayed");
        } else if (text === "Select device") {
            console.log("Devices are available, but none is selected");
            const deviceNotFound = await driver.findElement(By.className('devices-not-found-container'));
            assert.isTrue(await deviceNotFound.isDisplayed(), "Devices not found container should be displayed");

            const deviceNotFoundSubtitle = await driver.findElement(By.className('devices-not-found-subtitle'));
            const text = await deviceNotFoundSubtitle.getText();
            assert.include(text, "You can select one of available devices or create a new one to start.", "Text should be 'You can select one of available devices or create a new one to start.'");
        } else {
            console.log("Some device is selected");
            const phoneWrapper = await driver.findElement(By.className('phone-wrapper'));
            assert.isTrue(await phoneWrapper.isDisplayed(), "Phone wrapper should be displayed when a device is selected");
        }

    })


});