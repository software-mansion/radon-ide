import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import {
  RENDER_OUTLINES_PLUGIN_ID,
  RenderOutlinesEventListener,
  RenderOutlinesEventMap,
  RenderOutlinesInterface,
} from "../../common/RenderOutlines";
import { Devtools } from "../../project/devtools";
import { ToolPlugin } from "../../project/tools";

export class RenderOutlinesPlugin implements ToolPlugin, RenderOutlinesInterface, Disposable {
  private eventEmitter = new EventEmitter();
  private isEnabled = false;

  private devToolsListener = (event: string, payload: any): void => {
    if (event === "RNIDE_rendersReported") {
      this.eventEmitter.emit("rendersReported", payload);
    }
    if (event === "RNIDE_appReady") {
      this.setEnabled(this.isEnabled);
    }
  };

  constructor(private devtools: Devtools) {
    this.devtools.addListener(this.devToolsListener);
  }

  public readonly id = RENDER_OUTLINES_PLUGIN_ID;
  public readonly label = "Outline Renders";
  public readonly available = true;
  public readonly persist = false;

  activate(): void {
    this.setEnabled(true);
  }

  deactivate(): void {
    this.setEnabled(false);
  }

  dispose() {
    this.devtools.removeListener(this.devToolsListener);
  }

  setEnabled(isEnabled: boolean) {
    this.isEnabled = isEnabled;
    this.devtools.send("RNIDE_updateInstrumentationOptions", { isEnabled });
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
