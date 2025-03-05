import { Breakpoint } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { SourceMapConsumer } from "source-map";
import { CDPBreakpoint } from "./CDPBreakpoint";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { CDPSession } from "./CDPSession";

// NOTE: extracted from the type definition in "@vscode/debugprotocol"
const VALID_KEYS: (keyof DebugProtocol.Breakpoint)[] = [
  "id",
  "verified",
  "message",
  "source",
  "line",
  "column",
  "endLine",
  "endColumn",
  "instructionReference",
  "offset",
  "reason",
];

function isKeyOfBreakpoint(key: string): key is keyof DebugProtocol.Breakpoint {
  return VALID_KEYS.includes(key as keyof DebugProtocol.Breakpoint);
}

export class BreakpointsController {
  private breakpoints = new Map<string, Array<CDPBreakpoint>>();

  constructor(
    private sourceMapController: SourceMapsRegistry,
    private cdpSession: CDPSession,
    private breakpointsAreRemovedOnContextCleared: boolean
  ) {}

  public onContextCleared() {
    // When execution context is cleared (JS reloads), the old RN debugger would forget
    // all the breakpoints that were previously set. This leads to the situation, when
    // we may get breakpoint IDs misaligned. Because of that, when we execute CDPBreakpoint.reset
    // to update the breakpoint, we may attempt to delete a different breakpoint or we'd just fail to
    // delete it altogether if that breakpoint hasn't been yet set in the new execution context.
    // In that scenario, it is better to clear all the breakpints we'd previously set as we'd get a
    // request from DAP to set them again when the new context is ready (we send InitializeRequest).
    //
    // On the other hand, we can't reset the breakpoints with the new debugger. If we do that,
    // the breakpoints that are set in between reloads will be set twice with CDP. There is no
    // API in CDP that'd allow us to query for the existing breakpoints, so we rely on the fact
    // that ths breakpoints are maintained including the IDs that we got when we set them.
    if (this.breakpointsAreRemovedOnContextCleared) {
      // we forget all the breakpoints when the context is cleared
      this.breakpoints.clear();
    }
  }

  public updateBreakpointsInSource(sourceURL: string, consumer: SourceMapConsumer) {
    // this method gets called after we are informed that a new script has been parsed. If we
    // had breakpoints set in that script, we need to let the runtime know about it

    // the number of consumer mapping entries can be close to the number of symbols in the source file.
    // we optimize the process by collecting unique source URLs which map to actual individual source files.
    // note: apparently despite the TS types from the source-map library, mapping.source can be null
    const uniqueSourceMapPaths = new Set<string>();
    consumer.eachMapping((mapping) => mapping.source && uniqueSourceMapPaths.add(mapping.source));

    uniqueSourceMapPaths.forEach((sourceMapPath) => {
      const absoluteFilePath =
        this.sourceMapController.toAbsoluteFilePathFromSourceMapAlias(sourceMapPath);
      const breakpoints = this.breakpoints.get(absoluteFilePath) || [];
      breakpoints.forEach(async (bp) => {
        await bp.reset();
      });
    });
  }

  public async setBreakpoints(
    sourcePath: string,
    breakpoints: DebugProtocol.SourceBreakpoint[] | undefined
  ): Promise<DebugProtocol.Breakpoint[]> {
    const previousBreakpoints = this.breakpoints.get(sourcePath) || [];

    const newBreakpoints = (breakpoints || []).map((bp) => {
      const previousBp = previousBreakpoints.find(
        (prevBp) => prevBp.line === bp.line && prevBp.column === bp.column
      );
      if (previousBp) {
        return previousBp;
      } else {
        return new CDPBreakpoint(
          this.cdpSession,
          this.sourceMapController,
          sourcePath,
          bp.line,
          bp.column
        );
      }
    });

    // remove old breakpoints
    previousBreakpoints.forEach((bp) => {
      if (
        bp.verified &&
        !newBreakpoints.find((newBp) => newBp.line === bp.line && newBp.column === bp.column)
      ) {
        bp.delete();
      }
    });

    this.breakpoints.set(sourcePath, newBreakpoints);

    const resolvedBreakpoints = await Promise.all<Breakpoint>(
      newBreakpoints.map(async (bp) => {
        await bp.set();
        return bp;
      })
    );

    const serializedBreakpoints = resolvedBreakpoints.map((bp) => {
      const entries = Object.entries(bp).filter(([key]) => isKeyOfBreakpoint(key));
      return Object.fromEntries(entries) as DebugProtocol.Breakpoint;
    });

    return serializedBreakpoints;
  }
}
