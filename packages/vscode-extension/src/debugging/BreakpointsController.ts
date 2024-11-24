import { Breakpoint } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { SourceMapConsumer } from "source-map";
import { CDPBreakpoint } from "./CDPBreakpoint";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { CDPSession } from "./CDPSession";

export class BreakpointsController {
  private breakpoints = new Map<string, Array<CDPBreakpoint>>();

  constructor(private sourceMapController: SourceMapsRegistry, private cdpSession: CDPSession) {}

  public resetBreakpoints() {
    this.breakpoints.clear();
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
  ) {
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

    return resolvedBreakpoints;
  }
}
