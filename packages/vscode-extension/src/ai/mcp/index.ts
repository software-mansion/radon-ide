import vscode, { commands, ExtensionContext, Disposable } from "vscode";
import { getEditorType, EditorType } from "../../utilities/editorType";
import { registerStaticTools } from "./toolRegistration";
import { registerMCPTools } from "./RadonMcpController";

function setGlobalUseDirectToolRegistering(useStaticRegistering: boolean) {
  commands.executeCommand("setContext", "RNIDE.useStaticToolRegistering", useStaticRegistering);
}

function shouldUseDirectRegistering() {
  // The `vscode.lm.registerTool` API with image support only available in VSCode version 1.105+
  // This API is not implemented on Cursor, Windsurf or Antigravity. (it is a stub on these editors).
  return (
    vscode.version.localeCompare("1.105.0", undefined, { numeric: true }) >= 0 &&
    getEditorType() === EditorType.VSCODE
  );
}

export function registerRadonAI(context: ExtensionContext): Disposable {
  const useStaticRegistering = shouldUseDirectRegistering();
  setGlobalUseDirectToolRegistering(useStaticRegistering);
  if (useStaticRegistering) {
    return registerStaticTools();
  } else {
    return registerMCPTools(context);
  }
}
