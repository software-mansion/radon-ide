interface Measurement {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
}

export interface ScanEventListener<T> {
  (event: T): void;
}

export interface BlueprintOutline {
  name: string;
  count: number;
  elements: Measurement[];
  didCommit: 1 | 0;
}

export type BlueprintEntry = [number, BlueprintOutline];

export interface ScanEventMap {
  rendersReported: {
    blueprintOutlines: BlueprintEntry[];
  };
}

export interface ScanInterface {
  addEventListener<K extends keyof ScanEventMap>(
    type: K,
    listener: ScanEventListener<ScanEventMap[K]>
  ): void;
  removeEventListener<K extends keyof ScanEventMap>(
    type: K,
    listener: ScanEventListener<ScanEventMap[K]>
  ): void;
}
