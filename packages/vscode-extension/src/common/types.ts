export type PropsWithDataTest<P = unknown> = P & { dataTest?: string };

export type SourceData = {
  sourceURL: string;
  line: number;
  column: number;
};
