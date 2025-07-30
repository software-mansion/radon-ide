import { command } from "./subprocess";

/**
 * Tests a command by running it and checking its success.
 *
 * @param cmd The command to run.
 * @returns True if the command succeeded, false otherwise.
 */
export async function testCommand(cmd: string): Promise<boolean> {
  try {
    // We are not checking the stderr here, because some of the CLIs put the warnings there.
    const { failed } = await command(cmd, {
      encoding: "utf8",
      quietErrorsOnExit: true,
      env: { ...process.env, LANG: "en_US.UTF-8" },
    });
    return !failed;
  } catch (_) {
    return false;
  }
}
