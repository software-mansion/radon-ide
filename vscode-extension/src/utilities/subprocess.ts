import { Logger } from "../Logger";
import execa, { ExecaChildProcess } from "execa";
import readline from "readline";

export type ChildProcess = ExecaChildProcess<string>;

/**
 * When using this methid, the subprocess should be started with buffer: false option
 * as there's no need for allocating memory for the output that's going to be very long.
 */
export function lineReader(childProcess: ExecaChildProcess<string>) {
  const input = childProcess.stdout;
  if (!input) {
    throw new Error("Child process has no stdout");
  }
  const reader = readline.createInterface({
    input,
    terminal: false,
  });
  return {
    onLineRead: (callback: (line: string) => void) => {
      reader.on("line", callback);
    },
  };
}

export function exec(...args: [string, string[]?, execa.Options?]) {
  const subprocess = execa(...args);
  async function printErrorsOnExit() {
    try {
      const result = await subprocess;
      if (result.stderr) {
        Logger.debug(
          "Subprocess",
          args[0],
          args[1]?.join(" "),
          "produced error output:",
          result.stderr
        );
      }
    } catch (e) {
      // @ts-ignore idk how to deal with error objects in ts
      if (e.exitCode === undefined && e.signal !== undefined) {
        // @ts-ignore idk how to deal with error objects in ts
        Logger.info("Subprocess", args[0], "was terminated with", e.signal);
      } else {
        Logger.error(
          "Subprocess",
          args[0],
          args[1]?.join(" "),
          "execution resulted in an error:",
          e
        );
      }
    }
  }
  printErrorsOnExit(); // don't want to await here not to block the outer method
  return subprocess;
}

export function execSync(...args: [string, string[]?, execa.SyncOptions?]) {
  const result = execa.sync(...args);
  if (result.stderr) {
    Logger.debug(
      "Subprocess",
      args[0],
      args[1]?.join(" "),
      "produced error output:",
      result.stderr
    );
  }
  return result;
}

export function command(...args: [string, execa.Options?]) {
  const subprocess = execa.command(...args);
  async function printErrorsOnExit() {
    try {
      const result = await subprocess;
      if (result.stderr) {
        Logger.debug("Command", args[0], "produced error output:", result.stderr);
      }
    } catch (e) {
      Logger.error("Command", args[0], "execution resulted in an error:", e);
    }
  }
  printErrorsOnExit(); // don't want to await here not to block the outer method
  return subprocess;
}
