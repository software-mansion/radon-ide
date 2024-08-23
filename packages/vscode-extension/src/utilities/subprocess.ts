import { Logger } from "../Logger";
import execa, { ExecaChildProcess } from "execa";
import readline from "readline";
import { Platform } from "./platform";
import util from "util";
import { exec as bareExec } from "child_process";
const nodeExec = util.promisify(bareExec);

export type ChildProcess = ExecaChildProcess<string>;

export async function getPathEnv() {
  function extractLastPathVariable(env: string) {
    return env
      .split("\n")
      .filter((line) => /^(export )?PATH=/.test(line))
      .at(-1)
      ?.split("=")[1]
      .replaceAll("'", "");
  }

  async function getMiseEnv(shellPath: string) {
    // [Mise](https://mise.jdx.dev) is the only widely used tool manager that
    // doesn't inject shims or paths in the PATH. It relies on a shell hook
    // which won't be triggered when running a ZSH in a subprocess.

    // fish, bash, and zsh all support -i and -c flags
    const { stdout: miseEnv } = await nodeExec(
      `${shellPath} -i -c 'whence mise > /dev/null && mise hook-env | grep \"PATH=\"'`
    );
    return extractLastPathVariable(miseEnv);
  }

  async function getEnv(shellPath: string) {
    // fish, bash, and zsh all support -i and -c flags
    const { stdout: env } = await nodeExec(`${shellPath} -i -c 'env | grep \"PATH=\"'`);
    return extractLastPathVariable(env);
  }

  const shellPath = process.env.SHELL ?? "/bin/zsh";
  const [miseEnv, env] = await Promise.all([getMiseEnv(shellPath), getEnv(shellPath)]);
  return miseEnv ?? env;
}

let pathEnv: string | undefined;
export async function setupPathEnv() {
  if (!pathEnv) {
    pathEnv = await getPathEnv();
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
  if (pathEnv) {
    options = {
      ...options,
      env: { ...options?.env, PATH: pathEnv ?? options?.env?.PATH },
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

export function command(commandWithArgs: string, options?: execa.Options & { quiet?: boolean }) {
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

  if (!options?.quiet) {
    printErrorsOnExit(); // don't want to await here not to block the outer method
  }

  return subprocess;
}
