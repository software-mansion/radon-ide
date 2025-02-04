import { RelativePattern, Uri, workspace } from "vscode";

export interface EasConfig {
  build?: EasBuildConfig;
}

export type EasBuildConfig = {
  [key: string]: EasBuildProfile;
};

export interface EasBuildProfile {}

function isEasConfig(obj: unknown): obj is EasConfig {
  return (
    typeof obj === "object" && obj !== null && !("build" in obj && typeof obj.build !== "object")
  );
}

export async function readEasConfig(appRootFolder: string | Uri): Promise<EasConfig | null> {
  const easConfigUri = await workspace.findFiles(
    new RelativePattern(appRootFolder, "eas.json"),
    null,
    1
  );
  if (easConfigUri.length === 0) {
    return null;
  }
  try {
    const easConfigData = await workspace.fs.readFile(easConfigUri[0]);
    const easConfig = JSON.parse(new TextDecoder().decode(easConfigData));
    if (isEasConfig(easConfig)) {
      return easConfig;
    }
    return null;
  } catch (err) {
    return null;
  }
}
