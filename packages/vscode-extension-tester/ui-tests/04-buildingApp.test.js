import { By } from "vscode-extension-tester";
import { findAndWaitForElement } from "../utils/helpers.js";
import { addNewDevice, openRadonIDEPanel } from "./interactions.js";
import { get } from "./setupTest.js";

describe("Network panel tests", () => {
  it("Should build app", async () => {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    await addNewDevice(driver, "newDevice");
    await findAndWaitForElement(
      driver,
      By.css(`[data-test="phone-screen"]`),
      "Timed out waiting for phone-screen",
      600000
    );
  });
});
