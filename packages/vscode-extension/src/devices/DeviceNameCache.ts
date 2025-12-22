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

let fetchModelsPromise: Promise<DeviceModels | null> | null;

async function readCacheFile(): Promise<CacheFile | null> {
  try {
    const fileUri = Uri.joinPath(extensionContext.globalStorageUri, DEVICE_MODELS_FILENAME);
    const file = await workspace.fs.readFile(fileUri);
    const json = JSON.parse(file.toString()) as CacheFile;
    return json;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "FileNotFound") {
      Logger.error(`Error reading device models cache file: ${(error as Error).message}`);
    }
    return null;
  }
}

async function writeCacheFile(data: DeviceModels): Promise<void> {
  try {
    const fileUri = Uri.joinPath(extensionContext.globalStorageUri, DEVICE_MODELS_FILENAME);
    const contents = {
      savedAt: Date.now(),
      data: data,
    };
    await workspace.fs.createDirectory(extensionContext.globalStorageUri);
    await workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(contents), "utf-8"));
    return;
  } catch (error) {
    Logger.error(`Error writing device models cache file: ${(error as Error).message}`);
  }
}

async function fetchDeviceModels(): Promise<DeviceModels | null> {
  try {
    const response = await fetch(DEVICE_MODELS_URL);
    const json = await response.json();
    return json;
  } catch (error) {
    Logger.error(`Error fetching device models: ${(error as Error).message}`);
    return null;
  }
}

async function getDeviceModels(refetchIfNotOnList?: string): Promise<DeviceModels | null> {
  const file = await readCacheFile();
  if (
    file &&
    (!refetchIfNotOnList || findDeviceModelWithTolerance(refetchIfNotOnList, file.data).length > 0)
  ) {
    return file.data;
  }
  if (fetchModelsPromise) {
    return await fetchModelsPromise;
  }
  fetchModelsPromise = fetchDeviceModels();
  const json = await fetchModelsPromise;
  if (json) {
    await writeCacheFile(json);
  }
  // NOTE: even if `fetchModelsPromise` resolves to null, we don't want to reset it,
  // in order to avoid attempting refetching the models list over and over.
  // Instead, we rely on it only being called once per extension activation here,
  // so the list can be re-fetched only after restart.
  return json;
}

export async function getClosestDeviceModel(modelId: string): Promise<DeviceModel | null> {
  const devices = await getDeviceModels(modelId);
  if (!devices) {
    return null;
  }
  const matchingModels = findDeviceModelWithTolerance(modelId, devices);
  if (matchingModels.length === 1) {
    return matchingModels[0];
  }
  // If more than one ID matches, we pick the closest one
  else if (matchingModels.length > 1) {
    let bestMatch: DeviceModel | null = null;
    let smallestDistance = Infinity;
    for (const device of matchingModels) {
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

// Some devices report model names with different (or no) characters in between, e.g. "LM-F100" vs "LM_F100" vs "LMF100"
function findDeviceModelWithTolerance(modelId: string, deviceModels: DeviceModels): DeviceModel[] {
  if (deviceModels[modelId]) {
    return [deviceModels[modelId]];
  }
  const cleanId = modelId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const matchingModels = Object.keys(deviceModels)
    .filter((key) => {
      const cleanModel = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      return cleanModel === cleanId;
    })
    .map((key) => deviceModels[key]);
  return matchingModels;
}

function levenshteinDistance(a: string, b: string): number {
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
}
