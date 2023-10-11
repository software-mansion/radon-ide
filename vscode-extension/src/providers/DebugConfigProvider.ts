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
      // type: "pwa-node",
      request: "attach",
      name: "React Native Preview Debugger",
      // sourceMaps: true,
      // localRoot: folder?.uri.fsPath,
      // remoteRoot: `http://localhost:${metroPort}`,
      websocketAddress: `ws://localhost:${metroPort}/inspector/debug?device=0&page=1`,
      // internalConsoleOptions: "neverOpen",
      // sourceMapPathOverrides: {},
      // attachExistingChildren: true,
      // trace: true,
    };
  }
}
