import { VSBrowser, WebView, Workbench } from "vscode-extension-tester";
import { paths } from "../data/testData.js";
import { openProjectInVSCode } from "../utils/projectLauncher.js";
import { EditorView } from "vscode-extension-tester";

export function sharedTestLifecycle() {
  let browser, driver, workbench, view;
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

    view = new WebView();
    await openProjectInVSCode(browser, driver, paths.projectPath, workbench);
  });

  afterEach(async function () {
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  return () => ({ browser, driver, workbench, view });
}
