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
    if (debugConfiguration.type === "pwa-node") {
      const pendingTargetId = debugConfiguration.__pendingTargetId;
      const configuredByUs = debugConfiguration?.__sztudioConfigured;
      if (!pendingTargetId || configuredByUs) {
        // if we don't recognize js-debug's config (by the presence of __pendingTargetId)
        // or that this was a session started by us (by the presence of __sztudioConfigured)
        // we don't interfere with the config
        return debugConfiguration;
      }

      const parentId = debugConfiguration.__parentId;
      if (
        !parentId ||
        parentId !== debug.activeDebugSession?.id ||
        !debug.activeDebugSession?.configuration.metroPort
      ) {
        // we also let the config pass through if the current session is not a child of the
        // debug session started from preview (we recognize this by the presence of metroPort)
        return debugConfiguration;
      }

      // finally, if this is a child session spawne by js-debug, we start a new debug session
      // such that we can override options, we return undefine to interrupt session initiated
      // by js-debug
      debug.startDebugging(
        folder,
        { ...debugConfiguration, __sztudioConfigured: true },
        {
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
        }
      );
      return undefined;
    }
    const metroPort = debugConfiguration.metroPort;
    return {
      ...debugConfiguration,
      type: "pwa-node",
      request: "attach",
      name: "React Native Preview Debugger",
      sourceMaps: true,
      localRoot: folder?.uri.fsPath,
      remoteRoot: `http://localhost:${metroPort}`,
      websocketAddress: `ws://localhost:${metroPort}/inspector/debug?device=0&page=1`,
      internalConsoleOptions: "neverOpen",
      sourceMapPathOverrides: {},
      attachExistingChildren: true,
      trace: true,
    };
  }
}
