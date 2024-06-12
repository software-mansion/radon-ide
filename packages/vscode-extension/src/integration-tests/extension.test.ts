import assert from "assert";
import vscode from "vscode";
import sinon from "sinon";
import { after } from "mocha";

after(() => {
  sinon.restore();
});

test("Shows error on Windows", async () => {
  stubWindowsPlatform();
  const { showErrorMessage } = stubMessageBox();

  await getExtension().activate();

  assert.ok(showErrorMessage.calledOnceWith("React Native IDE works only on macOS."));
});

function stubWindowsPlatform() {
  sinon.stub(process, "platform").value("win32");
}

function stubMessageBox() {
  const showInformationMessage = sinon.stub(vscode.window, "showInformationMessage");
  const showWarningMessage = sinon.stub(vscode.window, "showWarningMessage");
  const showErrorMessage = sinon.stub(vscode.window, "showErrorMessage");

  return { showInformationMessage, showWarningMessage, showErrorMessage };
}

function getExtension() {
  return vscode.extensions.getExtension("swmansion.react-native-ide")!;
}
