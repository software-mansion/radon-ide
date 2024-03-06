export interface BuildProgressProcessor {
  processLine(line: string): Promise<void>;
}
