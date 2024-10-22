// Model identifiers for new devices are sourced from 'hw.device.name'
// in config.ini for Android and 'deviceType' in device.plist for iOS.

type DeviceTypeInfo = {
  model: string;
  modelId: string;
};

// iOS devices names should match supportedDeviceTypes identifiers inside the runtime
const iosSupportedDevices: DeviceTypeInfo[] = [
  {
    model: "iPhone SE (3rd generation)",
    modelId: "com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation",
  },
  {
    model: "iPhone 15 Pro",
    modelId: "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro",
  },
];

// android devices names are used to set proper device profile on the emulator
const androidSupportedDevices: DeviceTypeInfo[] = [
  {
    model: "Google Pixel 6a",
    modelId: "pixel_6a",
  },
  {
    model: "Google Pixel 7",
    modelId: "pixel_7",
  },
  {
    model: "Google Pixel 8",
    modelId: "pixel_8",
  },
  {
    model: "Google Pixel 9",
    modelId: "pixel_9",
  },
];

export function mapIdToModel(deviceId: string): string {
  const device = iosSupportedDevices
    .concat(androidSupportedDevices)
    .find((d) => d.modelId === deviceId);
  if (device) {
    return device.model;
  } else {
    throw new Error("Device id not recognized");
  }
}

export function mapModelToId(modelName: string): string {
  const device = iosSupportedDevices
    .concat(androidSupportedDevices)
    .find((d) => d.model === modelName);
  if (device) {
    return device.modelId;
  } else {
    throw new Error("Device model name not recognized");
  }
}
