import { until } from "selenium-webdriver";

export async function waitForElement(driver, element, timeout = 5000) {
  await driver.wait(
    until.elementIsVisible(element),
    timeout,
    `Could not find the element: ${element}`
  );
}
