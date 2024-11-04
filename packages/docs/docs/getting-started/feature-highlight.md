---
id: feature-highlight
title: Feature highlight
sidebar_position: 5
---

Visit [Radon IDE](https://ide.swmansion.com/) website, for a nicely presented list of the feature highlights.

## Click to inspect

Using the built-in inspector you can jump directly from preview to a file where your component is defined.

Learn more about the [Element Inspector](/docs/features/element-inspector).

<video autoPlay loop width="700" controls className="shadow-image">

  <source src="/video/2_sztudio_inspect.mp4" type="video/mp4"/>
</video>

## Use breakpoints right in VSCode

Without any additional setup the extension allows to add a breakpoints in Visual Studio Code to debug your React Native application.
IDE also automatically stops at runtime exceptions showing you the exact line of code where they happened.

Learn more about the [Debugging and logging](/docs/features/debugging-and-logging).

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/3_sztudio_debugger.mp4" type="video/mp4"/>
</video>

## Logs integration

Radon IDE uses the built-in VSCode console allowing you to filter through the logs.
The links displayed in the console are automatically linking back to your source code.

Learn more about the [Debugging and logging](/docs/features/debugging-and-logging).

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/5_sztudio_logs_panel.mp4" type="video/mp4"/>
</video>

## Router integration

The Radon IDE integrates with your deep-linked application allowing you to jump around the navigation structure.

Learn more about the [Router integration](/docs/features/router-integration).

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/4_sztudio_url_bar.mp4" type="video/mp4"/>
</video>

## Develop components in isolation

Develop your components individually without distractions.

Install `radon-ide` package and use `preview` function from it to define the components that should render in preview mode:

```js
import { preview } from "radon-ide";

preview(<MyComponent param={42} />);
```

The extension will display a clickable "Open preview" button over the line with `preview` call that you can use to launch into the preview mode.

Learn more about [Previews](/docs/features/previews).

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/6_sztudio_preview.mp4" type="video/mp4"/>
</video>

## Adjust device settings on the fly

You can adjust text size and light/dark mode right from the Radon IDE.
Focus just on your app without switching between windows.

Learn more about the [Device settings](/docs/features/device-settings).

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/7_sztudio_device_settings.mp4" type="video/mp4"/>
</video>
