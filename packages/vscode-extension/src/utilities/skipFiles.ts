import { Minimatch } from "minimatch";

export class SkipFilesProcessor {
  private skipFiles: Minimatch[];

  constructor(skipFiles: string[]) {
    this.skipFiles = skipFiles.map(
      (pattern) => new Minimatch(pattern, { flipNegate: true, dot: true })
    );
  }

  public shouldAcceptFile(fileName: string) {
    let accept = true;
    for (const pattern of this.skipFiles) {
      if (pattern.match(fileName)) {
        accept = pattern.negate;
      }
    }
    return accept;
  }

  public shouldSkipFile(fileName: string) {
    return !this.shouldAcceptFile(fileName);
  }
}
