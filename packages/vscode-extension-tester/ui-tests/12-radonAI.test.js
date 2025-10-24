import { WebView, EditorView, By, Key } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { describeIf } from "../utils/helpers.js";
import { get } from "./setupTest.js";

const isLatestCode =
  !process.env.CODE_VERSION || process.env.CODE_VERSION === "latest";

// on older versions vscode requires logging to github to use AI chat
describeIf(isLatestCode, "12 - Radon AI tests", () => {
  let driver,
    workbench,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    vscodeHelperService;

  before(async () => {
    ({ driver, workbench } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      vscodeHelperService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    const view = new WebView();
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  beforeEach(async function () {
    ({ driver } = get());
    await radonViewsService.openRadonIDEPanel();

    await driver.switchTo().defaultContent();

    await vscodeHelperService.openCommandLineAndExecute("Chat: Open Chat");
    // second command sets focus on chat input
    await vscodeHelperService.openCommandLineAndExecute("Chat: Open Chat");
  });

  afterEach(async function () {
    await driver.actions().sendKeys(Key.BACK_SPACE).perform();
    await vscodeHelperService.openCommandLineAndExecute(
      "Developer: Reload Window"
    );
    await driver.actions().sendKeys(Key.ENTER).perform();
    await driver.sleep(1000);
    await vscodeHelperService.openCommandLineAndExecute(
      "View: Toggle Secondary Side Bar Visibility"
    );
  });

  after(async () => {
    await workbench.executeCommand("Chat: Open Chat");
    await workbench.executeCommand(
      "View: Toggle Secondary Side Bar Visibility"
    );
  });

  it("Radon AI should show in suggestions after typing @ in chat", async function () {
    await driver.actions().sendKeys("@").perform();
    await driver.switchTo().defaultContent();

    // it's vscode native element we have to find it by css class
    const suggestionsPopUp = await elementHelperService.findAndWaitForElement(
      By.css(".suggest-widget")
    );
    await suggestionsPopUp.findElement(
      By.xpath("//*[contains(text(), 'radon')]")
    );
  });

  it("Radon AI user should appear in chat", async function () {
    await driver.actions().sendKeys("@radon test").perform();
    await driver.actions().sendKeys(Key.ENTER).perform();

    const auxiliaryBar = await elementHelperService.findAndWaitForElement(
      By.css(".auxiliarybar")
    );

    const usernameElements = await auxiliaryBar.findElements(
      By.css(".username")
    );

    for (const usernameElement of usernameElements) {
      if ((await usernameElement.getText()) === "Radon AI") {
        return;
      }
    }

    throw new Error("Radon AI response element not found");
  });
});
