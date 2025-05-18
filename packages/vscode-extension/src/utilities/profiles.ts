import path from "path";
import fs from "fs";
import { DebugSessionCustomEvent, Uri, workspace, window, commands, extensions } from "vscode";

export async function maybeHandleProfileFile(event: DebugSessionCustomEvent) {
  if (event.body && event.body.filePath) {
    const tempFilePath = event.body.filePath;

    // Show save dialog to save the profile file to the workspace folder:
    let defaultUri = Uri.file(tempFilePath);
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      defaultUri = Uri.file(path.join(workspaceFolder.uri.fsPath, path.basename(tempFilePath)));
    }

    const saveDialog = await window.showSaveDialog({
      defaultUri,
      filters: {
        "CPU Profile": ["cpuprofile"],
      },
    });

    if (saveDialog) {
      await fs.promises.copyFile(tempFilePath, saveDialog.fsPath);
      commands.executeCommand("vscode.open", Uri.file(saveDialog.fsPath));

      // verify whether flame chart visualizer extension is installed
      // flame chart visualizer is not necessary to open the cpuprofile file, but when it is installed,
      // the user can use the flame button from cpuprofile view to visualize it differently
      const flameChartExtension = extensions.getExtension("ms-vscode.vscode-js-profile-flame");
      if (!flameChartExtension) {
        const GO_TO_EXTENSION_BUTTON = "Go to Extension";
        window
          .showInformationMessage(
            "Flame Chart Visualizer extension is not installed. It is recommended to install it for better profiling insights.",
            GO_TO_EXTENSION_BUTTON
          )
          .then((action) => {
            if (action === GO_TO_EXTENSION_BUTTON) {
              commands.executeCommand(
                "workbench.extensions.search",
                "ms-vscode.vscode-js-profile-flame"
              );
            }
          });
      }
    }
  }
}
