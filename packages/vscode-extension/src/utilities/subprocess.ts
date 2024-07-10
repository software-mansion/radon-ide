import { Logger } from "../Logger";
import execa, { ExecaChildProcess } from "execa";
import readline from "readline";

export type ChildProcess = ExecaChildProcess<string>;

function updatePWDInArgs<T extends execa.Options>(args: [string, string[]?, T?]): typeof args;
function updatePWDInArgs<T extends execa.Options>(args: [string, T?]): typeof args;

function updatePWDInArgs<T extends execa.Options>(args: [string, string[]?, T?]) {
  if (args.length > 1) {
    const options = args[args.length - 1] as T;
    if (options && options.cwd) {
      (args[args.length - 1] as T) = { ...options, env: { ...options.env, PWD: "0" } };
    }
  }
  return args;
}

/**
 * When using this methid, the subprocess should be started with buffer: false option
 * as there's no need for allocating memory for the output that's going to be very long.
 */
export function lineReader(childProcess: ExecaChildProcess<string>, includeStderr = false) {
  const input = childProcess.stdout;
  if (!input) {
    throw new Error("Child process has no stdout");
  }
  const stdoutReader = readline.createInterface({
    input,
    terminal: false,
  });
  let stderrReader = null;
  if (includeStderr && childProcess.stderr) {
    stderrReader = readline.createInterface({
      input: childProcess.stderr!,
      terminal: false,
    });
  }
  return {
    onLineRead: (callback: (line: string) => void) => {
      stdoutReader.on("line", callback);
      stderrReader?.on("line", callback);
    },
  };
}

export function exec(
  ...args: [string, string[]?, (execa.Options & { allowNonZeroExit?: boolean })?]
) {
  const subprocess = execa(...updatePWDInArgs(args));
  const allowNonZeroExit = args[2]?.allowNonZeroExit;
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
      const { exitCode, signal } = e;
      if (exitCode === undefined && signal !== undefined) {
        Logger.info("Subprocess", args[0], "was terminated with", signal);
      } else {
        if (!allowNonZeroExit || !exitCode) {
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
  }
  printErrorsOnExit(); // don't want to await here not to block the outer method
  return subprocess;
}

export function execSync(...args: [string, string[]?, execa.SyncOptions?]) {
  const result = execa.sync(...updatePWDInArgs(args));
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
  const subprocess = execa.command(...updatePWDInArgs(args));
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
