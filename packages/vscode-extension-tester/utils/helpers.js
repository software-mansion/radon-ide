import { until } from "selenium-webdriver";
import { By, TextEditor, WebView, ActivityBar } from "vscode-extension-tester";
import * as path from "path";

export async function waitForElement(driver, element, timeout = 5000) {
  await driver.wait(
    until.elementIsVisible(element),
    timeout,
    `Could not find the element: ${element}`
  );
}

export async function findAndWaitForElement(
  driver,
  selector,
  timeoutMessage,
  timeout = 10000
) {
  const element = await driver.wait(
    until.elementLocated(selector),
    timeout,
    timeoutMessage
  );
  await waitForElement(driver, element);
  return element;
}

export async function findAndWaitForElementByTag(
  driver,
  tagName,
  timeoutMessage = `Timed out waiting for element by tag ${tagName}`,
  timeout = 10000
) {
  const selector = By.css(`[data-test="${tagName}"]`);
  return findAndWaitForElement(driver, selector, timeoutMessage, timeout);
}

export async function findAndClickElementByTag(
  driver,
  dataTag,
  timeout = 15000,
  message = `Timed out waiting for element with tag name ${dataTag}`
) {
  const element = await findAndWaitForElement(
    driver,
    By.css(`[data-test="${dataTag}"]`),
    message,
    timeout
  );
  element.click();
}

export async function waitUntilElementGone(
  driver,
  locator,
  timeout = 5000,
  message = "Element did not disappear"
) {
  await driver.wait(
    async () => {
      const elements = await driver.findElements(locator);
      return elements.length === 0;
    },
    timeout,
    message
  );
}

export async function getCursorLineInEditor(driver) {
  const editor = new TextEditor();
  return (await editor.getCoordinates())[0];
}

export async function getFileNameInEditor(driver) {
  const editor = new TextEditor();
  const fullPath = await editor.getFilePath();
  return path.basename(fullPath);
}

export async function getDebuggerStopLineNumber(driver) {
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
