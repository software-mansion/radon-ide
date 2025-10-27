import * as path from "path";
import { until } from "selenium-webdriver";
import {
  By,
  TextEditor,
  WebView,
  ActivityBar,
  Key,
  Workbench,
} from "vscode-extension-tester";

export class ElementHelperService {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForElement(element, timeout = 5000) {
    await this.driver.wait(
      until.elementIsVisible(element),
      timeout,
      `Could not find the element: ${element}`
    );
  }

  async findAndWaitForElement(selector, timeoutMessage, timeout = 10000) {
    const element = await this.driver.wait(
      until.elementLocated(selector),
      timeout,
      timeoutMessage
    );
    await this.driver.executeScript("arguments[0].scrollIntoView()", element);
    await this.waitForElement(element);
    return element;
  }

  async findAndWaitForElementByTag(
    tagName,
    timeoutMessage = `Timed out waiting for element by tag ${tagName}`,
    timeout = 10000
  ) {
    const selector = By.css(`[data-testid="${tagName}"]`);
    return this.findAndWaitForElement(selector, timeoutMessage, timeout);
  }

  async findAndClickElementByTag(
    dataTag,
    timeout = 15000,
    message = `Timed out waiting for element with tag name ${dataTag}`
  ) {
    const element = await this.findAndWaitForElement(
      By.css(`[data-testid="${dataTag}"]`),
      message,
      timeout
    );
    await element.click();
    return element;
  }

  async waitUntilElementGone(
    locator,
    timeout = 5000,
    message = "Element did not disappear"
  ) {
    await this.driver.wait(
      async () => {
        const elements = await this.driver.findElements(locator);
        return elements.length === 0;
      },
      timeout,
      message
    );
  }

  async safeFind(selector) {
    const elements = await this.driver.findElements(selector);
    return elements.length > 0 ? elements[0] : null;
  }

  async hasClass(element, className) {
    const classes = await element.getAttribute("class");
    return classes?.split(" ").includes(className) ?? false;
  }
}

export class VSCodeHelperService {
  constructor(driver) {
    this.driver = driver;
  }

  async openFileInEditor(path) {
    await this.driver.switchTo().defaultContent();
    await this.openCommandLineAndExecute("workbench.action.files.openFile");
    console.log("Opening file: " + process.cwd() + path);
    this.driver
      .actions()
      .keyDown(Key.COMMAND)
      .sendKeys("a")
      .keyUp(Key.COMMAND)
      .sendKeys(process.cwd() + path)
      .sendKeys(Key.ENTER)
      .perform();
  }

  async getCursorLineInEditor() {
    const editor = new TextEditor();
    const lineNumber = (await editor.getCoordinates())[0];
    return lineNumber;
  }

  async getFileNameInEditor() {
    const editor = new TextEditor();
    const fullPath = await editor.getFilePath();
    return path.basename(fullPath);
  }

  async getDebuggerStopLineNumber() {
    const view = new WebView();
    await view.switchBack();

    const btn = await new ActivityBar().getViewControl("Run");
    const debugView = await btn.openView();
    const num = 1;

    const callStack = await debugView.getCallStackSection();
    const items = await callStack.getVisibleItems();
    const item = await items.at(num);
    const tooltip = await item.getTooltip();

    let line;

    const match = tooltip.match(/line (\d+)/);
    if (match) {
      line = parseInt(match[1], 10);
      console.log("Line number:", line);
    }

    return line;
  }

  // in some situations workbench.executeCommand() is not working properly
  async openCommandLineAndExecute(command) {
    await this.driver.switchTo().defaultContent();
    await this.driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("p")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();
    await this.driver.actions().sendKeys(command).perform();
    await this.driver.actions().sendKeys(Key.ENTER).perform();
  }

  async hideSecondarySideBar() {
    await this.driver.switchTo().defaultContent();
    const workbench = new Workbench();
    await workbench.executeCommand("Chat: Open Chat");
    await workbench.executeCommand(
      "View: Toggle Secondary Side Bar Visibility"
    );
  }
}
