import { NullablePosition, SourceMapConsumer } from "source-map";
import { Logger } from "../Logger";
import path from "path";

function compareIgnoringHost(url1: string, url2: string) {
  try {
    const firstURL = new URL(url1);
    const secondURL = new URL(url2);
    firstURL.hostname = secondURL.hostname = "localhost";
    firstURL.port = secondURL.port = "8080";
    return firstURL.href === secondURL.href;
  } catch (e) {
    return false;
  }
}

export class SourceMapController {
  private sourceMaps: Array<[string, string, SourceMapConsumer, number]> = [];
  private sourceMapFilePaths: Set<string> = new Set();

  constructor(
    private expoPreludeLineCount: number,
    private sourceMapAliases?: Array<[string, string]>
  ) {}

  public clearSourceMaps() {
    this.sourceMaps = [];
    this.sourceMapFilePaths.clear();
  }

  public async registerSourceMap(
    sourceMap: any,
    sourceURL: string,
    scriptId: string,
    isMainBundle: boolean
  ): Promise<SourceMapConsumer> {
    const consumer = await new SourceMapConsumer(sourceMap);

    // Expo env plugin has a bug that causes the bundle to include so-called expo prelude module named __env__
    // which is not present in the source map. As a result, the line numbers are shifted by the amount of lines
    // the __env__ module adds. If we detect that main bundle is loaded, but __env__ is not there, we use the provided
    // expoPreludeLineCount which reflects the number of lines in __env__ module to offset the line numbers in the source map.
    const bundleContainsExpoPrelude = sourceMap.sources.includes("__env__");
    let lineOffset = 0;
    if (isMainBundle && !bundleContainsExpoPrelude && this.expoPreludeLineCount > 0) {
      Logger.debug(
        "Expo prelude lines were detected and an offset was set to:",
        this.expoPreludeLineCount
      );
      lineOffset = this.expoPreludeLineCount;
    }

    // add all sources from consumer to sourceMapFilePaths
    consumer.sources.forEach((source) => {
      this.sourceMapFilePaths.add(source);
    });
    this.sourceMaps.push([sourceURL, scriptId, consumer, lineOffset]);
    return consumer;
  }

  public findOriginalPosition(
    scriptIdOrURL: string,
    lineNumber1Based: number,
    columnNumber0Based: number
  ) {
    let scriptURL = "__script__";
    let sourceURL = "__source__";
    let sourceLine1Based = lineNumber1Based;
    let sourceColumn0Based = columnNumber0Based;

    this.sourceMaps.forEach(([url, id, consumer, lineOffset]) => {
      // when we identify script by its URL we need to deal with a situation when the URL is sent with a different
      // hostname and port than the one we have registered in the source maps. The reason for that is that the request
      // that populates the source map (scriptParsed) is sent by metro, while the requests from breakpoints or logs
      // are sent directly from the device. In different setups, specifically on Android emulator, the device uses different URLs
      // than localhost because it has a virtual network interface. Hence we need to unify the URL:
      if (id === scriptIdOrURL || compareIgnoringHost(url, scriptIdOrURL)) {
        scriptURL = url;
        const pos = consumer.originalPositionFor({
          line: lineNumber1Based - lineOffset,
          column: columnNumber0Based,
        });
        if (pos.source !== null) {
          sourceURL = pos.source;
        }
        if (pos.line !== null) {
          sourceLine1Based = pos.line;
        }
        if (pos.column !== null) {
          sourceColumn0Based = pos.column;
        }
      }
    });

    return {
      sourceURL: this.toAbsoluteFilePathFromSourceMapAlias(sourceURL),
      lineNumber1Based: sourceLine1Based,
      columnNumber0Based: sourceColumn0Based,
      scriptURL,
    };
  }

  public toGeneratedPosition(
    absoluteFilePath: string,
    lineNumber1Based: number,
    columnNumber0Based: number
  ) {
    // New React Native 76 debugger uses file aliases in source maps, however, the aliases are not
    // used in some settings (i.e. with Expo projects). For calculating the generated position, we
    // need to use the file path that is present in source maps. We first try to check if the aliased
    // file path is there, and if it's not, we use the original absolute file path.
    let sourceMapAliasedFilePath = this.toSourceMapAliasedFilePath(absoluteFilePath);
    let sourceMapFilePath = this.sourceMapFilePaths.has(sourceMapAliasedFilePath)
      ? sourceMapAliasedFilePath
      : absoluteFilePath;

    let position: NullablePosition = { line: null, column: null, lastColumn: null };
    let originalSourceURL: string = "";
    this.sourceMaps.forEach(([sourceURL, scriptId, consumer, lineOffset]) => {
      const pos = consumer.generatedPositionFor({
        source: sourceMapFilePath,
        line: lineNumber1Based,
        column: columnNumber0Based,
        bias: SourceMapConsumer.LEAST_UPPER_BOUND,
      });
      if (pos.line !== null) {
        originalSourceURL = sourceURL;
        position = { ...pos, line: pos.line + lineOffset };
      }
    });
    if (position.line === null) {
      return null;
    }
    return {
      source: originalSourceURL,
      lineNumber1Based: position.line,
      columnNumber0Based: position.column,
    };
  }

  public toAbsoluteFilePathFromSourceMapAlias(sourceMapPath: string) {
    if (this.sourceMapAliases) {
      for (const [alias, absoluteFilePath] of this.sourceMapAliases) {
        if (sourceMapPath.startsWith(alias)) {
          // URL may contain ".." fragments, so we want to resolve it to a proper absolute file path
          return path.resolve(path.join(absoluteFilePath, sourceMapPath.slice(alias.length)));
        }
      }
    }
    return sourceMapPath;
  }

  private toSourceMapAliasedFilePath(sourceAbsoluteFilePath: string) {
    if (this.sourceMapAliases) {
      // we return the first alias from the list
      for (const [alias, absoluteFilePath] of this.sourceMapAliases) {
        if (absoluteFilePath.startsWith(absoluteFilePath)) {
          return path.join(alias, path.relative(absoluteFilePath, sourceAbsoluteFilePath));
        }
      }
    }
    return sourceAbsoluteFilePath;
  }
}
