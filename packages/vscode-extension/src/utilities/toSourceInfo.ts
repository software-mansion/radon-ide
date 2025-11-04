import { SourceInfo } from "../common/Project";
import { SourceData } from "../common/types";

export function toSourceInfo(source: SourceData): SourceInfo {
  return {
    fileName: source.sourceURL,
    column0Based: source.column,
    line0Based: source.line,
  };
}
