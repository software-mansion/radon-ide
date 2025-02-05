import { RelativePattern, Uri, workspace } from "vscode";
import { EasConfig, isEasConfig } from "../common/EasConfig";

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
