import { Logger } from "../Logger";
import { createWorkspaceFingerprint } from "../utilities/fingerprint";
import { buildAndroid } from "./buildAndroid";
import { buildIos } from "./buildIOS";

export class BuildManager {
  private fingerprintHash: string | undefined;
  private checkCache: boolean;
  private workspaceDir: string;
  private iOSBuild: Promise<{ appPath: string; bundleID: string }> | undefined;
  private androidBuild: Promise<{ apkPath: string; packageName: string }> | undefined;

  constructor(workspaceDir: string) {
    this.checkCache = true;
    this.workspaceDir = workspaceDir;
  }

  public setCheckCache(checkCache: boolean) {
    this.checkCache = checkCache;
  }

  public getAndroidBuild() {
    return this.androidBuild;
  }

  public getIosBuild() {
    return this.iOSBuild;
  }

  private async prepareAndroidBuild(checkCache: boolean) {
    if (checkCache && this.androidBuild) {
      Logger.log("Cache hit on android build. Using existing build.");
      return this.androidBuild;
    }

    return buildAndroid(this.workspaceDir);
  }

  private async prepareIosBuild(checkCache: boolean) {
    if (checkCache && this.iOSBuild) {
      Logger.log("Cache hit on ios build. Using existing build.");
      return this.iOSBuild;
    }

    return buildIos(this.workspaceDir);
  }

  public async startBuilding() {
    let newFingerPrintHash;
    try {
      newFingerPrintHash = await createWorkspaceFingerprint();
    } catch (e) {
      Logger.warn("Couldn't get the fingerprint of the app.");
    }

    const sameFingerprint = newFingerPrintHash === this.fingerprintHash;

    const shouldCheckCache = sameFingerprint && this.checkCache;

    if (!!newFingerPrintHash && !sameFingerprint) {
      this.fingerprintHash = newFingerPrintHash;
    }

    this.iOSBuild = this.prepareIosBuild(shouldCheckCache);
    this.androidBuild = this.prepareAndroidBuild(shouldCheckCache);
  }
}
