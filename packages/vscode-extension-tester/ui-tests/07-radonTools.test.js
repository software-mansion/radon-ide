import * as fs from "fs";
import * as path from "path";
import {
  By,
  EditorView,
  WebView,
  BottomBarPanel,
  TextEditor,
  Key,
} from "vscode-extension-tester";
import { assert } from "chai";
import { cropCanvas, compareImages } from "../utils/imageProcessing.js";
import initServices from "../services/index.js";
import { centerCoordinates, safeDescribe } from "../utils/helpers.js";
import { TIMEOUTS } from "../utils/timeouts.js";
import { get } from "./setupTest.js";

const cwd = process.cwd() + "/data";

safeDescribe("7 - Radon tools tests", () => {
  let driver, appWebsocket, view, workbench;
  let {
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService,
    vscodeHelperService,
  } = initServices(driver);

  before(async () => {
    ({ driver, view, workbench } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
      radonSettingsService,
      vscodeHelperService,
    } = initServices(driver));

    await managingDevicesService.prepareDevices();

    await appManipulationService.waitForAppToLoad();

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    await workbench.executeCommand("Remove All Breakpoints");
    radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    // expo apps start with developer menu overlay opened
    await appManipulationService.hideExpoOverlay(appWebsocket);
  });

  const testIfInspectElementAppearsInCorrectPlace = async () => {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-element-inspector-button"
    );

    // Corresponds to the element's location in the test application
    const originalPosition = { x: 0.1, y: 0.1, width: 0.1, height: 0.1 };

    const phoneScreen = await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid="phone-screen"]`),
      "Timed out waiting for phone-screen"
    );

    const position = centerCoordinates(originalPosition);

    const phoneRect = await phoneScreen.getRect();
    const phoneWidth = phoneRect.width;
    const phoneHeight = phoneRect.height;

    const actions = driver.actions({ bridge: true });

    await actions
      .move({
        origin: phoneScreen,
        x: Math.floor((position.x + position.width / 2) * phoneWidth),
        y: Math.floor((position.y + position.height / 2) * phoneHeight),
      })
      .perform();

    const inspectArea = await elementHelperService.findAndWaitForElementByTag(
      "phone-inspect-area"
    );

    const inspectAreaRect = await inspectArea.getRect();
    const relativeRect = {
      x: (inspectAreaRect.x - phoneRect.x) / phoneWidth,
      y: (inspectAreaRect.y - phoneRect.y) / phoneHeight,
      width: inspectAreaRect.width / phoneWidth,
      height: inspectAreaRect.height / phoneHeight,
    };

    for (const key in originalPosition) {
      assert.approximately(
        originalPosition[key],
        relativeRect[key],
        // NOTE: allow a 2% of the screen width/height margin of error
        0.02,
        `Inspect area ${key} is incorrect`
      );
    }
  };

  it("Should make element inspector active", async () => {
    const elementInspectorButton =
      await elementHelperService.findAndClickElementByTag(
        "radon-bottom-bar-element-inspector-button"
      );

    const isActive = await elementHelperService.hasClass(
      elementInspectorButton,
      "icon-button-selected"
    );

    assert.isTrue(isActive, "Element inspector button is not active");
  });

  it("Element Inspector: Should open component source file", async () => {
    const componentSourceFile = "TrackableButton.tsx";

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-element-inspector-button"
    );

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInsidePhoneScreen(position);

    driver.switchTo().defaultContent();

    const editorView = new EditorView();
    const titles = await editorView.getOpenEditorTitles();

    assert.include(titles, componentSourceFile);
  });

  const inspectOverlayParamsTable = [
    { name: "portrait orientation", rotate: false },
    { name: "landscape orientation", rotate: true },
  ];

  inspectOverlayParamsTable.forEach(({ name, rotate }) => {
    it(`should show inspect overlay in correct place ${name}`, async function () {
      try {
        await radonSettingsService.rotateDevice(
          rotate ? "landscape-left" : "portrait"
        );

        await driver.wait(async () => {
          const orientation =
            await appManipulationService.sendMessageAndWaitForResponse(
              appWebsocket,
              "getOrientation"
            );
          return orientation.value === rotate ? "landscape" : "portrait";
        }, TIMEOUTS.MEDIUM);

        await testIfInspectElementAppearsInCorrectPlace();
      } finally {
        await radonSettingsService.rotateDevice("portrait");
      }
    });
  });

  it("Right Click on App element: Should open component source file", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInsidePhoneScreen(position, true);

    await elementHelperService.findAndWaitForElementByTag(
      "inspect-data-menu-content"
    );

    const menuItem = await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid^="inspect-data-menu-item-"]`),
      "Timed out waiting for inspect data item name"
    );
    const attributeData = (await menuItem.getAttribute("data-testid")).split(
      "-"
    );
    const lineNumber = attributeData[attributeData.length - 1];
    const filename = attributeData[attributeData.length - 2];

    console.log({ lineNumber, filename });

    await menuItem.click();

    driver.switchTo().defaultContent();

    const editorView = new EditorView();
    await editorView.closeEditor("Radon IDE");

    assert.equal(
      await vscodeHelperService.getFileNameInEditor(),
      filename,
      "Opened file name is incorrect"
    );
    assert.equal(
      await vscodeHelperService.getCursorLineInEditor(),
      parseInt(lineNumber) + 1,
      "Cursor line number is incorrect"
    );
  });

  it("should save CPU profiling", async () => {
    const filePath = path.join(cwd, "cpuProfiling.cpuprofile");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await radonViewsService.openRadonToolsMenu();
    await elementHelperService.findAndClickElementByTag(
      "tools-dropdown-menu-cpu-profiling-button"
    );
    await driver.sleep(4000);
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-cpu-profiling-button"
    );

    await radonViewsService.findAndFillSaveFileForm("cpuProfiling");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for CPU profiling to be saved"
    );

    driver.wait(async () => {
      driver.switchTo().defaultContent();
      const editorView = new EditorView();
      const activeTab = await editorView.getActiveTab();
      const title = await activeTab?.getTitle();
      const fileExtension = title?.split(".").pop();
      return fileExtension === "cpuprofile";
    }, 5000);
  });

  it("should save React profiling", async () => {
    await radonViewsService.openRadonToolsMenu();
    await elementHelperService.findAndClickElementByTag(
      "tools-dropdown-menu-react-profiling-button"
    );

    // Simulate user interactions in the app to generate profiling data
    await driver.sleep(2000);
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "toggle-element-button"
    );
    appManipulationService.clickInsidePhoneScreen(position);
    await driver.sleep(2000);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-react-profiling-button"
    );

    driver.wait(async () => {
      driver.switchTo().defaultContent();
      const editorView = new EditorView();
      const activeTab = await editorView.getActiveTab();
      const title = await activeTab?.getTitle();
      const fileExtension = title?.split(".").pop();
      return fileExtension === "reactprofile";
    }, 5000);
  });

  it("should open preview", async () => {
    await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );
    const editor = new TextEditor();
    await driver.wait(
      async () => (await editor.getCodeLenses("Open preview")).length > 0,
      5000
    );
    const lenses = await editor.getCodeLenses("Open preview");

    await lenses[0].click();
    await radonViewsService.switchToRadonIDEFrame();
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      return url == "preview:TrackableButton";
    }, 5000);
  });

  it("should click button in preview", async () => {
    await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );
    const editor = new TextEditor();
    await driver.wait(
      async () => (await editor.getCodeLenses("Open preview")).length > 0,
      5000
    );
    const lenses = await editor.getCodeLenses("Open preview");

    await lenses[0].click();
    await radonViewsService.switchToRadonIDEFrame();
    await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "preview-button"
    );

    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );
    assert.equal(message.action, "preview-button");
  });

  it("should test show touches", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    let canvas = await radonViewsService.getPhoneScreenSnapshot();
    let button = cropCanvas(canvas, position);

    fs.writeFileSync(
      `debug_crop_before_click_${Date.now()}.png`,
      button.toBuffer("image/png")
    );

    await radonSettingsService.setShowTouches(true);

    let buttonAfterClick = null;

    await appManipulationService.clickInsidePhoneScreen(
      position,
      false,
      async () => {
        canvas = await radonViewsService.getPhoneScreenSnapshot();
        buttonAfterClick = cropCanvas(canvas, position);

        fs.writeFileSync(
          `debug_crop_during_click_${Date.now()}.png`,
          buttonAfterClick.toBuffer("image/png")
        );
      }
    );

    assert.isFalse(
      !buttonAfterClick || compareImages(button, buttonAfterClick)
    );
  });

  // it doesn't check if location where outlines appear is correct
  it("should show outlines", async () => {
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );

    await elementHelperService.findAndClickElementByTag(
      "dev-tool-outline-renders"
    );

    await driver.actions().sendKeys(Key.ESCAPE).perform();

    // monitors the overlay canvas for changes
    await driver.executeScript(() => {
      window.__overlayMaxPixels = 0;
      window.__overlayDetected = false;
      window.__stopMonitoring = false;

      function monitorOverlay() {
        if (window.__stopMonitoring) return;

        const canvas = document.querySelector(".render-outlines-overlay");
        if (canvas && canvas.width > 0) {
          const ctx = canvas.getContext("2d");
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

          let currentCount = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 0) currentCount++;
          }
          if (currentCount > window.__overlayMaxPixels) {
            window.__overlayMaxPixels = currentCount;
          }

          if (currentCount > 1000) {
            window.__overlayDetected = true;
          }
        }
        requestAnimationFrame(monitorOverlay);
      }
      requestAnimationFrame(monitorOverlay);
    });

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "toggle-element-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    // some time to let overlay appear and be detected
    await driver.sleep(1000);

    const result = await driver.executeScript(() => {
      window.__stopMonitoring = true;

      return {
        detected: window.__overlayDetected,
        maxPixels: window.__overlayMaxPixels,
      };
    });

    assert.isAbove(
      result.maxPixels,
      1000,
      "Overlay should appear with > 1000 pixels"
    );
  });

  // test scenario:
  // - creates two devices
  // - rotates one of them
  // - the element inspector should work correctly after switching to second device
  it(`should show inspect overlay in correct place after rotating and changing device`, async function () {
    try {
      const deviceName1 = "newDevice";
      const deviceName2 = "newDevice2";

      await managingDevicesService.addNewDevice(deviceName2);
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
      await managingDevicesService.switchToDevice(deviceName2);
      await appManipulationService.waitForAppToLoad();

      await driver.wait(async () => {
        appWebsocket = get().appWebsocket;
        return appWebsocket != null;
      }, 5000);

      await appManipulationService.hideExpoOverlay(appWebsocket);

      await radonSettingsService.rotateDevice("landscape-left");

      await driver.wait(async () => {
        const orientation =
          await appManipulationService.sendMessageAndWaitForResponse(
            appWebsocket,
            "getOrientation"
          );
        return orientation.value === "landscape";
      }, 5000);

      await managingDevicesService.switchToDevice(deviceName1);

      await driver.sleep(TIMEOUTS.SHORT);

      await testIfInspectElementAppearsInCorrectPlace();
    } finally {
      await radonSettingsService.rotateDevice("portrait");
    }
  });
});
