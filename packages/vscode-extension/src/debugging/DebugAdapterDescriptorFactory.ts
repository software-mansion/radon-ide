import vscode from "vscode";
import { DebugAdapter } from "./DebugAdapter";

export class DebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const configuration = session.configuration;
    return new vscode.DebugAdapterInlineImplementation(new DebugAdapter(configuration));
  }
}
