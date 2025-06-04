interface Measurement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderOutlinesEventListener<T> {
  (event: T): void;
}

export interface BlueprintOutline {
  name: string;
  count: number;
  boundingRect: Measurement;
  didCommit: 1 | 0;
}

export type BlueprintEntry = [number, BlueprintOutline];

export interface RenderOutlinesEventMap {
  rendersReported: {
    blueprintOutlines: BlueprintEntry[];
  };
}

export const RENDER_OUTLINES_PLUGIN_ID = "render-outlines";

export interface RenderOutlinesInterface {
  addEventListener<K extends keyof RenderOutlinesEventMap>(
    type: K,
    listener: RenderOutlinesEventListener<RenderOutlinesEventMap[K]>
  ): void;
  removeEventListener<K extends keyof RenderOutlinesEventMap>(
    type: K,
    listener: RenderOutlinesEventListener<RenderOutlinesEventMap[K]>
  ): void;
}
