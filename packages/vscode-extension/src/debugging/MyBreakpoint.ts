import { Breakpoint, Source } from "@vscode/debugadapter";

export class MyBreakpoint extends Breakpoint {
  public readonly line: number;
  public readonly column: number | undefined;
  private _id: number | undefined;
  constructor(verified: boolean, line: number, column?: number, source?: Source) {
    super(verified, line, column, source);
    this.column = column;
    this.line = line;
  }
  setId(id: number): void {
    super.setId(id);
    this._id = id;
  }
  getId(): number | undefined {
    // we cannot use `get id` here, because Breakpoint actually has a private field
    // called id, and it'd collide with this getter making it impossible to set it
    return this._id;
  }
}
