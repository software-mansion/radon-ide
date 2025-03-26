import vscode from "vscode";
import { DebugAdapter } from "./DebugAdapter";
import { CDPDebugAdapter } from "./CDPDebugAdapter";

export class DebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new DebugAdapter());
  }
}

export class CDPDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const configuration = session.configuration;
    return new vscode.DebugAdapterInlineImplementation(new CDPDebugAdapter(configuration));
  }
}
