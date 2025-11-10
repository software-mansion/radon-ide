import path from "path";
import { workspace, Uri } from "vscode";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";

type DeviceModel = {
  brand: string;
  name: string;
};
type DeviceModels = Record<string, DeviceModel>;

type CacheFile = {
  savedAt: number;
  data: DeviceModels;
};

const DEVICE_MODELS_URL = "https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json";
const DEVICE_MODELS_FILENAME = "RNIDE_device_models.json";
const CACHE_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

async function readCacheFile(): Promise<CacheFile | null> {
  try {
    const filePath = path.join(extensionContext.globalStorageUri.fsPath, DEVICE_MODELS_FILENAME);
    const fileUri = Uri.file(filePath);
    const file = await workspace.fs.readFile(fileUri);
    const json = JSON.parse(file.toString()) as CacheFile;
    return json;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      Logger.info("Device models cache file does not exist, a new one will be created");
      return null;
    }
    Logger.error(`Error reading device models cache file: ${(error as Error).message}`);
    return null;
  }
}

async function writeCacheFile(data: DeviceModels): Promise<void> {
  try {
    const filePath = path.join(extensionContext.globalStorageUri.fsPath, DEVICE_MODELS_FILENAME);
    const contents = {
      savedAt: Date.now(),
      data: data,
    };
    await workspace.fs.createDirectory(Uri.file(path.dirname(filePath)));
    await workspace.fs.writeFile(
      Uri.file(filePath),
      Buffer.from(JSON.stringify(contents), "utf-8")
    );
    return;
  } catch (error) {
    Logger.error(`Error writing device models cache file: ${(error as Error).message}`);
  }
}

async function fetchDeviceModels(): Promise<DeviceModels> {
  try {
    const response = await fetch(DEVICE_MODELS_URL);
    const json = await response.json();
    return json;
  } catch (error) {
    Logger.error(`Error fetching device models: ${(error as Error).message}`);
    return {};
  }
}

export async function getDeviceModels(noRefetchIfPresent?: string): Promise<DeviceModels> {
  const file = await readCacheFile();
  const now = Date.now();
  if (file && now - file.savedAt < CACHE_DURATION_MS && file.data[noRefetchIfPresent ?? ""]) {
    return file.data;
  }
  const json = await fetchDeviceModels();
  await writeCacheFile(json);
  return json;
}

export async function getClosestDeviceModel(modelId: string): Promise<DeviceModel | null> {
  const devices = await getDeviceModels(modelId);
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
