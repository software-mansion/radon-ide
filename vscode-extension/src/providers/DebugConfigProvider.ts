import {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  ProviderResult,
  WorkspaceFolder,
  debug,
} from "vscode";

export class DebugConfigProvider implements DebugConfigurationProvider {
  resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken | undefined
  ): ProviderResult<DebugConfiguration> {
    const metroPort = debugConfiguration.metroPort;
    return {
      ...debugConfiguration,
      request: "attach",
      name: "React Native Preview Debugger",
      websocketAddress: `ws://localhost:${metroPort}/inspector/debug?device=0&page=1`,
      internalConsoleOptions: "neverOpen",
    };
  }
}
