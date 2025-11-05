import { SourceInfo } from "../common/Project";
import { DebugSession } from "../debugging/DebugSession";
import { Logger } from "../Logger";

export async function findSourcePosition(
  source: SourceInfo,
  debugSession: DebugSession
): Promise<SourceInfo | null> {
  if (source.fileName.startsWith("http")) {
    try {
      return await debugSession.findOriginalPosition(source);
    } catch (e) {
      Logger.error("Error finding original source position for element", source, e);
    }
  }

  return null;
}
