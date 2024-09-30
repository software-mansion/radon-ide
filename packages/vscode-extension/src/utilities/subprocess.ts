import readline from "readline";
import execa, { ExecaChildProcess } from "execa";
import { Logger } from "../Logger";
import { Platform } from "./platform";

export type ChildProcess = ExecaChildProcess<string>;

async function getPathEnv(appRoot: string) {
  // We run an interactive shell session to make sure that tool managers (nvm,
  // asdf, mise, etc.) are loaded and PATH is set correctly. Mise in
  // particular sets the PATH by hooking into change dir and prompt display
  // events.
  // We make sure of that by doing a cd into app root directory, which has
  // ensures that correct versions of tools are used (you can have different
  // versions based on directory in most managers).

  // Fish, bash, and zsh all support -i and -c flags.
  const shellPath = process.env.SHELL ?? "/bin/zsh";
  const { stdout: path } = await execa(shellPath, ["-i", "-c", `cd "${appRoot}" && echo "$PATH"`]);
  return path.trim();
}

let pathEnv: string | undefined;
export async function setupPathEnv(appRoot: string) {
  if (!pathEnv) {
    pathEnv = await getPathEnv(appRoot);
    if (!pathEnv) {
      throw new Error("Error in getting PATH environment variable");
    }
  }
}

function overrideEnv<T extends execa.Options>(options?: T): T | undefined {
  // Some processes rely on PWD environment variable to tell the current working
  // directory in which cases PWD takes precedence over process.cwd. By default,
  // execa would copy all process env to the subprocess (which is desired)
  // including PWD that may point to a different location that the selected cwd
  // (indicated by options.cwd). Specifically, when VSCode is launched from the
  // launcher (as opposed to being launched from command line using 'code'
  // command), the PWD is set to "/". This method overrides PWD to the current
  // cwd option when it's set for the subprocess call therefore removing the
  // risk of the subprocess using the wrong working directory.

  // Additionally, we overwrite PATH env variable using env from interactive
  // shell, ensuring that we have access to node and other tools, even when
  // VSCode is launched as an application and not from the terminal.
  const overridePath = options?.env?.PATH === undefined && pathEnv !== undefined;
  if (overridePath) {
    options = {
      ...options,
      env: { ...options?.env, PATH: pathEnv },
    } as unknown as T;
  }

  if (options?.cwd) {
    return { ...options, env: { ...options.env, PWD: options.cwd } };
  }
  return options;
}

/**
 * When using this methid, the subprocess should be started with buffer: false option
 * as there's no need for allocating memory for the output that's going to be very long.
 */
export function lineReader(childProcess: ExecaChildProcess<string>) {
  if (!childProcess.stdout) {
    throw new Error("Child process doesn't have stdout");
  }
  const stdoutReader = readline.createInterface({
    input: childProcess.stdout,
    terminal: false,
  });
  let stderrReader: readline.Interface | null = null;
  if (childProcess.stderr) {
    stderrReader = readline.createInterface({
      input: childProcess.stderr,
      terminal: false,
    });
  }
  return {
    onLineRead: (callback: (line: string, stderr?: boolean) => void) => {
      stdoutReader.on("line", callback);
      stderrReader?.on("line", (line) => callback(line, true));
    },
  };
}

export function exec(
  name: string,
  args?: string[],
  options?: execa.Options & { allowNonZeroExit?: boolean }
) {
  const subprocess = execa(
    name,
    args,
    Platform.select({ macos: overrideEnv(options), windows: options })
  );
  const allowNonZeroExit = options?.allowNonZeroExit;
  async function printErrorsOnExit() {
    try {
      const result = await subprocess;
      if (result.stderr) {
        Logger.debug("Subprocess", name, args?.join(" "), "produced error output:", result.stderr);
      }
    } catch (e) {
      // @ts-ignore idk how to deal with error objects in ts
      const { exitCode, signal } = e;
      if (exitCode === undefined && signal !== undefined) {
        Logger.info("Subprocess", name, "was terminated with", signal);
      } else {
        if (!allowNonZeroExit || !exitCode) {
          Logger.error("Subprocess", name, args?.join(" "), "execution resulted in an error:", e);
        }
      }
    }
  }
  printErrorsOnExit(); // don't want to await here not to block the outer method
  return subprocess;
}

export function execSync(name: string, args?: string[], options?: execa.SyncOptions) {
  const result = execa.sync(
    name,
    args,
    Platform.select({ macos: overrideEnv(options), windows: options })
  );
  if (result.stderr) {
    Logger.debug("Subprocess", name, args?.join(" "), "produced error output:", result.stderr);
  }
  return result;
}

export function command(
  commandWithArgs: string,
  options?: execa.Options & { quietErrorsOnExit?: boolean }
) {
  const subprocess = execa.command(
    commandWithArgs,
    Platform.select({ macos: overrideEnv(options), windows: options })
  );
  async function printErrorsOnExit() {
    try {
      const result = await subprocess;
      if (result.stderr) {
        Logger.debug("Command", commandWithArgs, "produced error output:", result.stderr);
      }
    } catch (e) {
      Logger.error("Command", commandWithArgs, "execution resulted in an error:", e);
    }
  }

  if (!options?.quietErrorsOnExit) {
    printErrorsOnExit(); // don't want to await here not to block the outer method
  }

  return subprocess;
}
