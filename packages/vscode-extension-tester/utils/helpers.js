import { until } from "selenium-webdriver";

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
