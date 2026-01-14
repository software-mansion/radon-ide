import * as path from "path";
import { until } from "selenium-webdriver";
import {
  By,
  TextEditor,
  EditorView,
  WebView,
  ActivityBar,
  Key,
  Workbench,
} from "vscode-extension-tester";
import { TIMEOUTS } from "../utils/timeouts.js";

// Determine the modifier key based on the platform (Command for Mac, Control for others if needed)
// For now, keeping COMMAND it may be changed in the future.
const MODIFIER_KEY = Key.COMMAND;

export class ElementHelperService {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForElement(element, timeout = TIMEOUTS.DEFAULT) {
    await this.driver.wait(
      until.elementIsVisible(element),
      timeout,
      `Could not find the element: ${element}`
    );
  }

  async findAndWaitForElement(
    selector,
    timeoutMessage,
    timeout = TIMEOUTS.MEDIUM
  ) {
    const element = await this.driver.wait(
      until.elementLocated(selector),
      timeout,
      timeoutMessage
    );
    await this.driver.executeScript("arguments[0].scrollIntoView()", element);
    await this.waitForElement(element, timeout);
    return element;
  }

  async findAndWaitForElementByTag(
    tagName,
    timeout = TIMEOUTS.MEDIUM,
    timeoutMessage = `Timed out waiting for element by tag ${tagName}`
  ) {
    const selector = By.css(`[data-testid="${tagName}"]`);
    return this.findAndWaitForElement(selector, timeoutMessage, timeout);
  }

  async findAndClickElementByTag(
    dataTag,
    timeout = TIMEOUTS.LONG,
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
    timeout = TIMEOUTS.DEFAULT,
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
    return elements[0] ?? null;
  }

  async hasClass(element, className) {
    const classes = await element.getAttribute("class");
    if (!classes) return false;
    return classes.split(/\s+/).includes(className);
  }
}

export class VSCodeHelperService {
  constructor(driver) {
    this.driver = driver;
  }

  async openFileInEditor(filePath) {
    await this.driver.switchTo().defaultContent();
    await this.openCommandLineAndExecute("workbench.action.files.openFile");

    const fullPath = path.join(process.cwd(), filePath);
    console.log("Opening file: " + fullPath);

    await this.driver.sleep(TIMEOUTS.SHORT);

    await this.driver
      .actions()
      .keyDown(MODIFIER_KEY)
      .sendKeys("a")
      .keyUp(MODIFIER_KEY)
      .sendKeys(fullPath)
      .sendKeys(Key.ENTER)
      .perform();

    await this.driver.sleep(TIMEOUTS.SHORT);
    const fileName = path.basename(filePath);

    const editorView = new EditorView();
    const isFileOpen = (await editorView.getOpenEditorTitles(0)).includes(
      path.basename(fileName)
    );
    if (isFileOpen) {
      const editor = await editorView.openEditor(fileName);
      return editor;
    }
  }

  async getCursorLineInEditor() {
    const editor = new TextEditor();
    const coordinates = await editor.getCoordinates();
    return coordinates[0];
  }

  async getFileNameInEditor() {
    const editor = new TextEditor();
    const fullPath = await editor.getFilePath();
    return path.basename(fullPath);
  }

  async getDebuggerStopLineNumber() {
    const view = new WebView();
    await view.switchBack();

    const runViewControl = await new ActivityBar().getViewControl("Run");
    const debugView = await runViewControl.openView();

    // Index of the stack frame to check
    const STACK_FRAME_INDEX = 1;

    const callStack = await debugView.getCallStackSection();
    const items = await callStack.getVisibleItems();

    if (items.length <= STACK_FRAME_INDEX) {
      return undefined;
    }

    const item = await items.at(STACK_FRAME_INDEX);
    const tooltip = await item.getTooltip();

    const match = tooltip.match(/line (\d+)/);
    if (match) {
      const line = parseInt(match[1], 10);
      console.log("Line number:", line);
      return line;
    }

    return undefined;
  }

  // In some situations, workbench.executeCommand() does not work properly
  async openCommandLineAndExecute(command) {
    await this.driver.switchTo().defaultContent();
    await this.driver
      .actions()
      .keyDown(MODIFIER_KEY)
      .keyDown(Key.SHIFT)
      .sendKeys("p")
      .keyUp(Key.SHIFT)
      .keyUp(MODIFIER_KEY)
      .perform();
    await this.driver.actions().sendKeys(command).perform();
    await this.driver.actions().sendKeys(Key.ENTER).perform();
  }

  async hideSecondarySideBar() {
    await this.driver.switchTo().defaultContent();
    const workbench = new Workbench();

    // Using Chat open command to ensure focus context before toggling sidebar
    await workbench.executeCommand("Chat: Open Chat");
    await workbench.executeCommand(
      "View: Toggle Secondary Side Bar Visibility"
    );
  }
}
