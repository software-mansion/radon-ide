import * as vscode from "vscode";
import { RelativePattern } from "vscode";
import { Logger } from "../Logger";
import { findAppRootFolder } from "../utilities/extensionContext";
import { calculateMD5 } from "../utilities/common";

interface Package {
  name: string;
  version: string;
}

const appRootFolder = findAppRootFolder() ?? "";
const result: Package[] = [];
let packageJsonHash: string;

async function getPackageJsonHash() {
  const rootPackageJson = await vscode.workspace.findFiles(
    new RelativePattern(appRootFolder, "package.json"),
    null,
    1
  );

  return await calculateMD5(rootPackageJson[0].fsPath);
}

async function getReactNativePackages(): Promise<Package[]> {
  // if we have already scanned the packages, we can skip the scan if package.json has not changed
  if (packageJsonHash) {
    const newPackageJsonHash = await getPackageJsonHash();
    if (newPackageJsonHash.digest("hex") === packageJsonHash) {
      return result;
    }
  } else {
    const hash = await getPackageJsonHash();
    packageJsonHash = hash.digest("hex");
  }

  // we scan node_modules here because different package managers use different lock files
  // and bun uses binary format - bun.lockb - which is not the easiest to parse
  const packageFiles = await vscode.workspace.findFiles(
    new RelativePattern(appRootFolder, "**/node_modules/{expo,react-native}*/package.json")
  );

  for await (const pkg of packageFiles) {
    try {
      const packageJsonDoc = await vscode.workspace.openTextDocument(pkg);
      const { name, version } = JSON.parse(packageJsonDoc.getText());
      result.push({ name, version });
    } catch (err) {
      Logger.error(`Error reading package.json: ${err}`);
      return [];
    }
  }

  return result;
}

export async function getReactNativePackagesPrompt(): Promise<string> {
  let prompt = "User has the following packages installed in the project :\n";
  const packages = await getReactNativePackages();

  if (packages.length === 0) {
    return "";
  }
  packages.forEach((pkg) => {
    prompt += `- ${pkg.name}@${pkg.version}\n`;
  });

  return prompt;
}
