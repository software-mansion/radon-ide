## Troubleshooting issues with React Native IDE

Below, we outline some ways that may help you self-diagnose and hopefully resolve issues you may encounter when using the React Native IDE extension.

### 1. Project setup diagnostics commands

This command can be located on the vscode commands palette when a given workspace is not recognized as a valid React Native of Expo project.
In this case lookup command called "React Native IDE: Diagnostics" – when executed it will show a notification message with pointers on why React Native IDE panel cannot be opened for this project.

### 2. Accessing extension logs

In order to access React Native IDE extension logs you need to open "Output Panel" with the default shortcut ⇧⌘U or by using a command named "Developer: Show Logs..." from the command palette.
On the "Output Panel", select "React Native IDE" as the source.
In order to share the logs with others you can use "Open Output in Editor" option available from the Output Panel toolbar.

> NOTE:
> In pre-release versions, the extension is configured to do a lot of verbose logging despite a different log level you may have set in your vscode's settings.
> This is done so that we don't need to ask you to change the log level setting that applies to all the extensions and the editor itself.
> As a consequence you may see a lot of unnecessary messages in the log output, but we still believe it'd give us better signal when dealing with potential issues.

### 3. Accessing build logs

Native builds are one of the most time consuming phases when launching your project.
Build processes output a lot of logs on their own and hence they have separate output channels.
When something goes wrong in the native build phase, instead of checking "React Native IDE" source in "Output Panel" as described in the previous point, select "React Native IDE (Android build)" or "React Native IDE (iOS build)" source depending on the platform you're building for.

### 4. General ways of recovering in case of errors

Here is what you can try when the extension got stuck on some errors:

- Try "Clean rebuild" option from the cog-wheel menu in the upper right corner of the extension panel
- Try closing and reopening extension panel
- Try restarting vscode ¯\\\_(ツ)\_/¯
