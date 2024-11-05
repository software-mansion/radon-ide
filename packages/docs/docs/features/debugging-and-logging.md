---
id: debugging-and-logging
title: Debugging and logging
sidebar_position: 2
---

Breakpoints can be a powerful debugging tool. Thanks to Radon IDE breakpoints now work in VSCode for React Native and Expo projects without any additional setup.

## Setting a breakpoint

You can set a breakpoint on any JavaScript line of code. To set a breakpoint click `Click to add a breakpoint` on the left margin of the line of code in your editor. The breakpoint will appear as a red dot next this line.

<img width="400" src="/img/docs/ide_add_breakpoint.png" className="shadow-image"/>

The Radon IDE will automatically pause the application execution whenever it encounters a breakpoint.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/3_sztudio_debugger.mp4" type="video/mp4"/>
</video>

## Debugger options

When code execution is paused, the debugger overlay includes several options for further debugging:

- **Resume execution** - resume code execution till the function ends, crashes or the debugger encounters another breakpoint,
- **Step over** - execute the current line of code and pause on the next line,
- **Open debugger console** - open the built-in VSCode log console.

<img width="300" src="/img/docs/ide_paused_in_debugger.png" className="shadow-image"/>

## Opening logs

Radon IDE keeps track of the application logs. You can access the device logs by clicking the `Logs` button in the top-right corner of the panel.

<img width="200" src="/img/docs/ide_logs_button.png" className="shadow-image"/>

## Jumping from log to code

In the logs panel, you can click the underlined component name on the right side of the panel to quickly jump to the exact line of code where the console log was called.

<img width="600" src="/img/docs/ide_jump_from_logs.png" className="shadow-image"/>

## Expanding logs

Radon IDE logs objects in a contracted form. You can expand the object log by clicking on it to see more details.

<img width="400" src="/img/docs/ide_logs_objects.png" className="shadow-image"/>

## Clearing logs console

You can clear the console by right-clicking inside the logs panel and choosing the `Clear Console` option or using the `⌘ K` shortcut.

<img width="450" src="/img/docs/ide_clear_console.png" className="shadow-image"/>

## Handling runtime errors

Whenever a runtime error occurs in JavaScript code, the Radon IDE displays an error overlay and highlights the exact line of code where the error occurred.

<img width="700" src="/img/docs/ide_uncaught_exception.png" className="shadow-image"/>

You can click the `Uncaught exception >` button on the error overlay to resume code execution. Radon IDE will try to recover from the error whenever possible.
