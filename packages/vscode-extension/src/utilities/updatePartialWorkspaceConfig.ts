import { WorkspaceConfiguration } from "vscode";

export async function updatePartialWorkspaceConfig(
  config: WorkspaceConfiguration,
  partialStateEntry: [string, any]
): Promise<void> {
  if (config.inspect(partialStateEntry[0] as string)?.workspaceValue) {
    await config.update(partialStateEntry[0] as string, partialStateEntry[1], false);
  } else {
    await config.update(partialStateEntry[0] as string, partialStateEntry[1], true);
  }
}
