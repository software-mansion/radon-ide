import { Logger } from "../Logger";

type DeviceModel = {
  brand: string;
  name: string;
};
type DeviceModels = Record<string, DeviceModel>;

const DEVICE_MODELS_URL = "https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

let cachedPromise: Promise<DeviceModels> | null = null;
let cachedAt = 0;

export async function getDeviceModels(): Promise<DeviceModels> {
  const now = Date.now();
  if (cachedPromise && now - cachedAt < CACHE_DURATION_MS) {
    return cachedPromise;
  }

  try {
    const response = await fetch(DEVICE_MODELS_URL);
    if (!response.ok) {
      Logger.warn(`Failed to fetch device models: ${response.statusText}`);
      return {};
    }
    const json = (await response.json()) as DeviceModels;
    cachedPromise = Promise.resolve(json ?? {});
    cachedAt = now;
    return cachedPromise;
  } catch (error) {
    Logger.error(`Error fetching device models: ${(error as Error).message}`);
    return {};
  }
}

export async function getClosestDeviceModel(modelId: string): Promise<DeviceModel | null> {
  const devices = await getDeviceModels();
  if (devices[modelId]) {
    return devices[modelId];
  }

  // Some devices report model names with different (or no) characters in between, e.g. "LM-F100" vs "LM_F100" vs "LMF100"
  const matchingDevices = Object.entries(devices).filter(([key, _]) => {
    const cleanDeviceId = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanPropsModel = modelId.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleanDeviceId === cleanPropsModel;
  });
  if (matchingDevices.length === 1) {
    return matchingDevices[0][1];
  }

  // If more than one ID matches, we pick the closest one
  else if (matchingDevices.length > 1) {
    let bestMatch: DeviceModel | null = null;
    let smallestDistance = Infinity;

    const levenshteinDistance = (a: string, b: string): number => {
      if (a === b) {
        return 0;
      }
      const m = a.length;
      const n = b.length;
      if (m === 0) {
        return n;
      }
      if (n === 0) {
        return m;
      }

      let previous = Array.from({ length: n + 1 }, (_, j) => j);
      let current = new Array<number>(n + 1);

      for (let i = 1; i <= m; i++) {
        current[0] = i;
        const ai = a.charAt(i - 1);
        for (let j = 1; j <= n; j++) {
          const cost = ai === b.charAt(j - 1) ? 0 : 1;
          current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        }
        [previous, current] = [current, previous];
      }

      return previous[n];
    };

    for (const [_, device] of matchingDevices) {
      const distance = levenshteinDistance(device.name, modelId);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        bestMatch = device;
      }
    }
    if (bestMatch) {
      return bestMatch;
    }
  }

  return null;
}
