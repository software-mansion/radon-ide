import { promisify } from "util";
import child_process from "child_process";
import { Logger } from "../Logger";
import readline from "readline";
import execa from "execa";

const promisifiedExec = promisify(child_process.exec);

export async function execWithLog(...args: Parameters<typeof promisifiedExec>) {
  try {
    const result = await promisifiedExec(...args);

    // stdout and err can be a Buffer so we convert it to string
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    if (!!stdout.length) {
      Logger.debug(result.stdout, args[0]);
    }
    if (!!stderr.length) {
      Logger.error(result.stderr, args[0]);
    }
    return { stdout, stderr };
  } catch (e) {
    Logger.error(`${e}`, args[0]);
    throw e;
  }
}

export function spawnWithLog(...args: Parameters<typeof child_process.spawn>) {
  const source = `${args[0]} ${args[1].join(" ")}`;
  try {
    const subprocess = child_process.spawn(...args);
    if (subprocess.stdout) {
      const readlineOutput = readline.createInterface({
        input: subprocess.stdout,
      });
      readlineOutput.on("line", (line: string) => Logger.debug(line, source));
    }

    if (subprocess.stderr) {
      const readlineError = readline.createInterface({
        input: subprocess.stderr,
      });
      readlineError.on("line", (line: string) => Logger.error(line, source));
    }
    return subprocess;
  } catch (e) {
    Logger.error(`${e}`, source);
    throw e;
  }
}

export function execFileSyncWithLog(...args: Parameters<typeof child_process.execFileSync>) {
  const source = `${args[0]}` + (` ${args[1]?.join(" ")}` ?? "");
  try {
    const result = child_process.execFileSync(...args);
    Logger.debug(result, source);
    return result;
  } catch (e) {
    Logger.error(`${e}`, source);
    throw e;
  }
}

export function execSyncWithLog(...args: Parameters<typeof child_process.execSync>) {
  try {
    const result = child_process.execSync(...args);
    Logger.debug(result, args[0]);
    return result;
  } catch (e) {
    Logger.error(`${e}`, args[0]);
    throw e;
  }
}

export async function execaWithLog(...args: [string, string[]?, execa.Options?]) {
  try {
    const result = await execa(...args);
    const { stdout, stderr, command } = result;
    if (!!stdout.length) {
      Logger.debug(stdout, command);
    }
    if (!!stderr.length) {
      Logger.error(stderr, command);
    }
    return result;
  } catch (e) {
    Logger.error(`${e}`);
    throw e;
  }
}

export async function execaCommandWithLog(...args: [string, execa.Options?]) {
  try {
    const result = await execa.command(...args);
    const { stdout, stderr, command } = result;
    if (!!stdout.length) {
      Logger.debug(stdout, command);
    }
    if (!!stderr.length) {
      Logger.error(stderr, command);
    }
    return result;
  } catch (e) {
    Logger.error(`${e}`);
    throw e;
  }
}
