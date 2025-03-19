import * as vscode from "vscode";
import { RelativePattern } from "vscode";
import { Logger } from "../Logger";
import { findAppRootFolder } from "../utilities/extensionContext";
import { calculateMD5 } from "../utilities/common";
import { CHAT_LOG } from ".";

interface Package {
  name: string;
  version: string;
}

const appRootFolder = findAppRootFolder() ?? "";
const packages: Package[] = [];
let packageJsonHash: string;

async function getPackageJsonHash(): Promise<string> {
  const rootPackageJson = await vscode.workspace.findFiles(
    new RelativePattern(appRootFolder, "package.json"),
    null,
    1
  );

  const hash = await calculateMD5(rootPackageJson[0].fsPath);
  return hash.digest("hex");
}

async function getReactNativePackages(): Promise<Package[]> {
  // if we have already scanned the packages, we can skip the scan if package.json has not changed
  if (packageJsonHash) {
    // check if hash is the same
    const newPackageJsonHash = await getPackageJsonHash();
    if (newPackageJsonHash === packageJsonHash) {
      return packages;
    }
    Logger.info(CHAT_LOG, "Found changes in package.json, rescanning packages");
    // update hash
    packageJsonHash = newPackageJsonHash;
    // empty packages array
    packages.length = 0;
  } else {
    // generate hash for the first time
    packageJsonHash = await getPackageJsonHash();
  }

  Logger.info(CHAT_LOG, "Scanning node_modules for React Native packages");
  // we scan node_modules here because different package managers use different lock files
  // and bun uses binary format - bun.lockb - which is not the easiest to parse
  const packageFiles = await vscode.workspace.findFiles(
    new RelativePattern(
      appRootFolder,
      "**/node_modules/**/*{expo,react-native,react-navigation}*/package.json"
    ),
    new RelativePattern(appRootFolder, "**/node_modules/**/*{export,exponent}*")
  );

  for await (const pkg of packageFiles) {
    try {
      const packageJsonDoc = await vscode.workspace.openTextDocument(pkg);
      const { name, version } = JSON.parse(packageJsonDoc.getText());
      packages.push({ name, version });
    } catch (err) {
      Logger.error(`Error reading package.json: ${err}`);
      return [];
    }
  }

  return packages;
}

export async function getReactNativePackagesPrompt(): Promise<string> {
  let prompt = "User has the following packages installed in the project :\n";
  const rnPackages = await getReactNativePackages();

  if (rnPackages.length === 0) {
    return "";
  }
  rnPackages.forEach((pkg) => {
    prompt += `- ${pkg.name}@${pkg.version}\n`;
  });

  return prompt;
}
