---
id: physical-devices
title: Physical Devices
sidebar_position: 8
---

## Running on a physical device

Radon IDE supports building and running your application on a physical Android phone or tablet connected to your development computer.

If you want to debug an application on a device running iOS, an [out-of-tree platform](https://reactnative.dev/docs/out-of-tree-platforms) or otherwise unsupported by Radon, you may want to try [Radon Connect](/docs/getting-started/connect-mode.md) instead.

### Using a physical Android device

1. Connect the device to your computer, either via [USB](https://developer.android.com/tools/adb#Enabling) or using [Wi-Fi](https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi).
2. Radon IDE should automatically detect the device, and present in the Device Select menu.

   <img width="700" src="/img/docs/ide_physical_device_select.png" className="shadow-image" />

3. Selecting the device should automatically build the application, install it on your device, and launch it.

   - the application might fail to launch if the device is locked during the launching process,
     causing the device preview to be stuck on the "Waiting for app to load..." step.
     To avoid this, make sure the device is unlocked.
   - on newer Android versions, you may be prompted to send the application for verification.
     This will block launching the app until an action is taken.
     For more information about this, see the [Google Play Protect documentation](https://developers.google.com/android/play-protect/warning-dev-guidance#send_app_for_security_check).

   <img height="400" src="/img/docs/ide_physical_play_protect.png" className="shadow-image" />
