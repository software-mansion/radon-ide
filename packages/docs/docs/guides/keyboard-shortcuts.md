---
id: keyboard-shortcuts
title: Keyboard shortcuts
sidebar_position: 4
---

Radon IDE lets you perform some repetitive actions through keyboard shortcuts.

| Result                                 | macOS                        |
| -------------------------------------- | ---------------------------- |
| Open developer menu                    | Command + Control + Z        |
| Capture replay                         | Command + Shift + R          |
| Toggle recording                       | Command + Shift + E          |
| Capture screenshot                     | Command + Shift + A          |
| Perform biometric authorization        | Command + Shift + M          |
| Perform failed biometric authorization | Option + Command + Shift + M |
| Close IDE Panel with confirmation      | Command + W                  |
| Switch to next running device          | Command + Shift + \)         |
| Switch to previous running device      | Command + Shift + \(         |
| Rotate device clockwise                | Control + Option + 0         |
| Rotate device anticlockwise            | Control + Option + 9         |

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
