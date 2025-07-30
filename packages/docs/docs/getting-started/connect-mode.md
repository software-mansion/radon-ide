---
id: connect-mode
title: Connect Mode
sidebar_position: 5
---

**Connect Mode** allows you to use some (currently limited) features of the Radon IDE while developing with your own React Native / Expo dev server ([Metro](https://metrobundler.dev/)) on your own simulator / emulator, or physical device.

In this mode, you don't use the [Radon Panel](/docs/getting-started/panel-mode), but instead Radon IDE connects automatically to your running applications.

## -sec-num- How does it work?

Radon Connect allows to connect a debugger to a variety of external devices, including Android phones, iPhones, external simulators, desktops, TVs, VR goggles, and web browsers.
Allowing you to debug these devices directly from your code editor without any additional setup.

It detects when you launch your app, either by using the Expo CLI or by other means, and automatically sets up the debugger connection and enables additional development workflows (see below) integrated with your editor.
The only thing that is necessary, is that you have a workspace opened in the editor that contains the app project that you run, and that you'd also enabled **Connect Mode** (documented in the next section).

<video autoPlay loop width="1100" controls className="shadow-image">
  <source src="/video/radon-connect.mp4" type="video/mp4"/>
</video>

## -sec-num- Enabling Connect Mode

When opening a new workspace, Radon IDE by default has the **Connect Mode** disabled.
You can enable it in one of the following ways:

### Using the button from the "Activity bar"

Hover the "Radon IDE" button in the activity bar, and click "Enable Radon Connect" link:

<img width="300" alt="Enable Radon Connect button on the Ativity Item menu" src="/img/docs/connect_activity_item_enable.png" className="shadow-image"/>

Later, you can also use the menu to disable Radon Connect and switch back to **Panel Mode**.

### Using the device select menu from [Radon Panel](/docs/getting-started/panel-interface)

If you have the Radon IDE Panel opened, you can use the device select menu to enable Radon Connect:

<img width="400" alt="Radon Connect button on the device selector menu" src="/img/docs/connect_device_selector_enable.png" className="shadow-image"/>

You can use the device selector later on to switch between **Connect Mode** and **Panel Mode**.
When in **Connect Mode**, the panel will only display a placeholder message that'd indicate the connection status.
There is no need to keep the panel open at any time when in **Connect Mode**.

## -sec-num- Differences to **Panel Mode**

**Panel Mode** allows the Radon IDE to manage the whole development workflow for you.
Starting from the development server, building the app, launching and debugging it, while also controlling the fleet of Android emulators or iOS simulators.
This makes it for much easier and integrated workflows as you don't need to control or use additional tools in order to work on your React Native or Expo project.

However, the **Panel Mode** is limited to working with the set of simulators it manages.
The **Connect Mode** is the best choice if you want to run your device in the environment that the **Panel Mode** currently doesn't support, like:

- Running your app on a physical device or a simulator type that isn't supported (i.e., tablet).
- Building for non-standard platforms ([out-of-tree platforms](https://reactnative.dev/docs/out-of-tree-platforms)), like TV or VR headset devices.
- If your project is setup as ["brownfield"](/docs/getting-started/compatibility#brownfield-projects) (however, some brownfield setups may work just fine with **Panel Mode** too).

The **Connect Mode** is a recent addition to Radon IDE and is in active development.
Currently, only [Debugging and logging](/docs/features/debugging-and-logging) feature is available in this mode while we are working on bringing better feature coverage.
