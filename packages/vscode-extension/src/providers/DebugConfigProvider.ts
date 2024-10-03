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
      request: "attach",
      name: "React Native Preview Debugger",
      websocketAddress: debugConfiguration.websocketAddress,
      internalConsoleOptions: "neverOpen",
    };
  }
}
