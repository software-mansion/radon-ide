import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import { RenderOutlinesEventListener, RenderOutlinesEventMap, RenderOutlinesInterface } from "../../common/RenderOutlines";
import { Devtools } from "../../project/devtools";
import { ToolPlugin } from "../../project/tools";

export const RENDER_OUTLINES_PLUGIN_ID = "RNIDE-render-outlines";

export class RenderOutlinesPlugin implements ToolPlugin, RenderOutlinesInterface, Disposable {
  private eventEmitter = new EventEmitter();

  private devToolsListener = (event: string, payload: any): void => {
    if (event === "RNIDE_rendersReported") {
      this.eventEmitter.emit("rendersReported", payload);
    }
  };

  constructor(private devtools: Devtools) {
    this.devtools.addListener(this.devToolsListener);
  }

  public readonly id = RENDER_OUTLINES_PLUGIN_ID;
  public readonly label = "Outline renders";
  public readonly available = true;

  activate(): void {
    this.setEnabled(true);
  }

  deactivate(): void {
    this.setEnabled(false);
  }

  openTool(): void {}

  dispose() {
    this.devtools.removeListener(this.devToolsListener);
  }

  setEnabled(isEnabled: boolean) {
    this.devtools.send("RNIDE_setInstrumentationOptions", { isEnabled });
  }

  addEventListener<K extends keyof RenderOutlinesEventMap>(
    type: K,
    listener: RenderOutlinesEventListener<RenderOutlinesEventMap[K]>
  ): void {
    this.eventEmitter.addListener(type, listener);
  }
  removeEventListener<K extends keyof RenderOutlinesEventMap>(
    type: K,
    listener: RenderOutlinesEventListener<RenderOutlinesEventMap[K]>
  ): void {
    this.eventEmitter.removeListener(type, listener);
  }
}
