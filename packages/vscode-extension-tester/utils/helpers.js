import { until } from "selenium-webdriver";
import { By } from "vscode-extension-tester";

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
  timeout = 5000
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
  timeout = 5000
) {
  const selector = By.css(`[data-test="${tagName}"]`);
  return findAndWaitForElement(driver, selector, timeoutMessage, timeout);
}

export async function findAndClickElementByTag(
  driver,
  dataTag,
  message = `Timed out waiting for element with tag name ${dataTag}`
) {
  const element = await findAndWaitForElement(
    driver,
    By.css(`[data-test="${dataTag}"]`),
    message
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
