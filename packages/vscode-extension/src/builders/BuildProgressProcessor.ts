export interface BuildProgressProcessor {
  processLine(line: string): void;
}
