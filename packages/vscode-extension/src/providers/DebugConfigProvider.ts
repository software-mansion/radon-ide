import {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  ProviderResult,
  WorkspaceFolder,
} from "vscode";

export class DebugConfigProvider implements DebugConfigurationProvider {
  resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken | undefined
  ): ProviderResult<DebugConfiguration> {
    return {
      ...debugConfiguration,
      internalConsoleOptions: "neverOpen",
    };
  }
}
