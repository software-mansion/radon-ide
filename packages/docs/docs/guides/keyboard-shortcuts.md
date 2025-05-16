---
id: keyboard-shortcuts
title: Keyboard shortcuts
sidebar_position: 4
---

Radon IDE lets you perform some repetitive actions through keyboard shortcuts.

| Result                                 | macOS                 | Windows             |
| -------------------------------------- | --------------------- | ------------------- |
| Open developer menu                    | Command + Control + Z | Control + Alt + Z   |
| Capture replay                         | Command + Shift + R   | Control + Shift + R |
| Toggle recording                       | Command + Shift + E   | Control + Shift + E |
| Capture screenshot                     | Command + Shift + A   | Control + Shift + A |
| Perform biometric authorization        | Command + Shift + M   | Control + Shift + M |
| Perform failed biometric authorization | Option + Command + Shift + M   | Control + Alt + Shift + M |
| Close IDE Panel with confirmation      | Command + W           | Control + W         |

## Customize shortcuts

You can adjust the Radon IDE bindings in the [VSCode keyboard shortcut editor](https://code.visualstudio.com/docs/getstarted/keybindings#_keyboard-shortcuts-editor).

You can open this editor by going to the menu under **Code > Settings > Keyboard Shortcuts** or by using the **Preferences: Open Keyboard Shortcuts** command (⌘K ⌘S).

<img width="700" src="/img/docs/ide_adjust_keybindings.png" className="shadow-image" />

## Unassigned actions

Some Radon IDE actions were left without a default keyboard shortcut. You can assign key bindings to them as you see fit.

| Command         | Description                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Open IDE Panel  | When no IDE panel exists this command creates a new one.                                        |
| Show IDE Panel  | Focuses on existing IDE panel.                                                                  |
| Close IDE Panel | Closes existing IDE panel.                                                                      |
| Diagnostics     | When extension was not activated even tho it should have this command performs diagnostics why. |
