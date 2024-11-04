---
id: device-management
title: Device management
sidebar_position: 1
---

Radon IDE manages its own instances of Android emulators and iOS simulators separately from the ones you normally create with Xcode or Android Studio. Thanks to this architecture, you can easily add, update and remove devices you no longer need directly from the Radon IDE panel.

You can open the manage devices modal in two ways. From the settings in the top-right corner **Settings > Manage devices...** or from the devices dropdown in the bottom-left corner of the panel.

<img width="650" src="/img/docs/ide_how_to_manage_devices.png" className="shadow-image" />

## Manage devices

The manage devices modal lists all your current devices. Here, you can add new devices with a `+ Create new device` button and remove devices with an red delete icon on the right of the listed device.

<img width="500" src="/img/docs/ide_manage_devices_modal.png" className="shadow-image" />

## Create device

Before creating the device you need to pick the **device type** and **system image**.

The **device type** affects the device frame shown in the Radon IDE preview. Currently, a very limited range of device types is supported.

The **system image** is the Android system image or iOS runtime running on the created device. In order for system images to appear in the Radon IDE, they first must be installed in Xcode or Android Studio, respectively. For more information, see [guide to Simulator System Images](/docs/guides/simulators).

<img width="500" src="/img/docs/ide_add_device.png" className="shadow-image" />

## Remove device

Clicking the delete icon in the manage devices modal will ask if you really want to delete this device. A deleted device cannot be restored. If you want to have the same device you deleted, you have to create it again.

<img width="500" src="/img/docs/ide_remove_device.png" className="shadow-image" />

## Switching current device

You can switch the device currently in use with the manage devices dropdown in the bottom-left corner of the Radon IDE panel.

<img width="250" src="/img/docs/ide_manage_devices.png" />
