import { WebView, SideBarView, EditorView } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

safeDescribe("9 - Radon Settings", () => {
  let driver,
    view,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    vscodeHelperService;

  before(async () => {
    ({ driver, view } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      vscodeHelperService,
    } = initServices(driver));

    await managingDevicesService.prepareDevices();

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    radonViewsService.openRadonIDEPanel();
    // it may take some time to load this element especially on GitHub CI
    await elementHelperService.findAndWaitForElementByTag("phone-wrapper");
  });

  it("should zoom in and out", async () => {
    // it may take some time to load this element especially on GitHub CI
    const phoneWrapper = await elementHelperService.findAndWaitForElementByTag(
      "phone-wrapper"
    );
    let height = (await phoneWrapper.getRect()).height;
    let newHeight = height;
    await radonViewsService.showZoomControls();

    await elementHelperService.findAndClickElementByTag("zoom-in-button");
    newHeight = (await phoneWrapper.getRect()).height;
    assert.isAbove(newHeight, height);
    height = newHeight;
    await elementHelperService.findAndClickElementByTag("zoom-out-button");
    newHeight = (await phoneWrapper.getRect()).height;
    assert.isBelow(newHeight, height);
  });

  it("should zoom in and out to preset levels", async () => {
    const zoomLevels = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const phoneWrapper = await elementHelperService.findAndWaitForElementByTag(
      "phone-wrapper"
    );
    let height = 0;

    for (const level of zoomLevels) {
      await radonViewsService.showZoomControls();

      await elementHelperService.findAndClickElementByTag(
        "zoom-select-trigger"
      );

      await elementHelperService.findAndClickElementByTag(
        `zoom-select-item-${level}`
      );
      const newHeight = (await phoneWrapper.getRect()).height;
      assert.isAbove(newHeight, height);
      height = newHeight;
    }
  });

  it("should fit device height to screen", async () => {
    const phoneDisplayContainer =
      await elementHelperService.findAndWaitForElementByTag(
        "phone-display-container"
      );

    const phoneWrapper = await elementHelperService.findAndWaitForElementByTag(
      "phone-wrapper"
    );

    const screenHeight = (await phoneDisplayContainer.getRect()).height;

    await radonViewsService.showZoomControls();
    await elementHelperService.findAndClickElementByTag("zoom-select-trigger");
    await elementHelperService.findAndClickElementByTag(`zoom-select-item-0.5`);

    await radonViewsService.showZoomControls();
    await elementHelperService.findAndClickElementByTag("zoom-select-trigger");
    await elementHelperService.findAndClickElementByTag(`zoom-select-item-fit`);

    const phoneHeight = (await phoneWrapper.getRect()).height;

    assert.equal(screenHeight, phoneHeight);
  });

  it("should fit device width to screen for device in landscape orientation", async () => {
    try {
      await driver.executeScript(`
        const evt = new KeyboardEvent('keydown', {
          key: '0',
          code: 'Digit0',
          altKey: true,
          ctrlKey: true,
          bubbles: true
        });
        document.dispatchEvent(evt);
        `);

      const phoneDisplayContainer =
        await elementHelperService.findAndWaitForElementByTag(
          "phone-display-container"
        );

      const phoneWrapper =
        await elementHelperService.findAndWaitForElementByTag("phone-wrapper");

      const screenWidth = (await phoneDisplayContainer.getRect()).width;

      await radonViewsService.showZoomControls();
      await elementHelperService.findAndClickElementByTag(
        "zoom-select-trigger"
      );
      await elementHelperService.findAndClickElementByTag(
        `zoom-select-item-0.5`
      );

      await radonViewsService.showZoomControls();
      await elementHelperService.findAndClickElementByTag(
        "zoom-select-trigger"
      );
      await elementHelperService.findAndClickElementByTag(
        `zoom-select-item-fit`
      );

      const phoneWidth = (await phoneWrapper.getRect()).width;

      assert.equal(screenWidth, phoneWidth);
    } finally {
      const phoneWrapper =
        await elementHelperService.findAndWaitForElementByTag("phone-wrapper");
      const phoneRect = await phoneWrapper.getRect();
      if (phoneRect.width > phoneRect.height) {
        await driver.executeScript(`
        const evt = new KeyboardEvent('keydown', {
          key: '9',
          code: 'Digit9',
          altKey: true,
          ctrlKey: true,
          bubbles: true
        });
        document.dispatchEvent(evt);
        `);
      }
    }
  });

  it("should move Radon IDE between side bar and editor area", async () => {
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-dropdown-change-ide-location-trigger"
    );

    let moveToSidePanelButton =
      await elementHelperService.findAndWaitForElementByTag(
        `settings-dropdown-move-to-side-panel-button`
      );
    await driver.executeScript("arguments[0].click();", moveToSidePanelButton);

    await driver.switchTo().defaultContent();

    const view = new SideBarView();
    await driver.wait(async () => {
      const title = await view.getTitlePart().getTitle();
      return title === "RADON IDE";
    }, 5000);

    // sometimes 'change IDE location' dropdown menu is not displaying properly and overflows screen
    // it caused errors on CI
    for (let i = 0; i < 4; i++)
      await vscodeHelperService.openCommandLineAndExecute(
        "Decrease Editor Width"
      );

    await radonViewsService.openRadonIDEPanel();

    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-dropdown-change-ide-location-trigger"
    );

    moveToSidePanelButton =
      await elementHelperService.findAndWaitForElementByTag(
        `settings-dropdown-move-to-editor-tab-button`
      );
    await driver.executeScript("arguments[0].click();", moveToSidePanelButton);

    await driver.switchTo().defaultContent();
    const editorView = new EditorView();
    await driver.wait(async () => {
      const titles = await editorView.getOpenEditorTitles();
      return titles.includes("Radon IDE");
    }, 5000);

    // return to default size
    for (let i = 0; i < 4; i++)
      await vscodeHelperService.openCommandLineAndExecute(
        "Increase Editor Width"
      );
  });
});
