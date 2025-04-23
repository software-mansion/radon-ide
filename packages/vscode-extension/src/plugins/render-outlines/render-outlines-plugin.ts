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
import { disposeAll } from "../../utilities/disposables";

export class RenderOutlinesPlugin implements ToolPlugin, RenderOutlinesInterface, Disposable {
  private eventEmitter = new EventEmitter();
  private isEnabled = false;
  private devtoolsListeners: Disposable[] = [];

  constructor(private devtools: Devtools) {
    this.devtoolsListeners.push(
      this.devtools.onEvent("RNIDE_appReady", () => {
        this.setEnabled(this.isEnabled);
      })
    );
    this.devtoolsListeners.push(
      this.devtools.onEvent("RNIDE_rendersReported", (payload) => {
        this.eventEmitter.emit("rendersReported", payload);
      })
    );
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
    disposeAll(this.devtoolsListeners);
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
