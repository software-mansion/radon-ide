import {
  Uri,
  TextDocument,
  WebviewPanel,
  CancellationToken,
  ExtensionContext,
  CustomTextEditorProvider,
  Disposable,
  window,
  workspace,
} from "vscode";
import { generateWebviewContent } from "../panels/webviewContentGenerator";

/**
 * Provider for React DevTools Profiler editors.
 */
export class ReactDevtoolsEditorProvider implements CustomTextEditorProvider {
  public static register(context: ExtensionContext): Disposable {
    const provider = new ReactDevtoolsEditorProvider(context);
    const providerRegistration = window.registerCustomEditorProvider(
      ReactDevtoolsEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = "RadonIDE.reactDevtoolsProfiler";

  constructor(private readonly context: ExtensionContext) {}

  /**
   * Called when our custom editor is opened.
   */
  public async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    _token: CancellationToken
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this.context.extensionUri, "dist"),
        Uri.joinPath(this.context.extensionUri, "node_modules"),
      ],
    };

    webview.onDidReceiveMessage(async (message) => {
      // load the file here and send formatted data to the webview
      const file = await workspace.openTextDocument(Uri.file(document.uri.fsPath));
      const data = file.getText();

      webview.postMessage({
        type: "profiler-data",
        data: data,
      });
    });

    webview.html = generateWebviewContent(
      this.context,
      webview,
      this.context.extensionUri,
      "react-devtools-profiler",
      "src/react-devtools-profiler",
      undefined,
      true
    );
  }
}
