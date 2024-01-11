import { ExtensionContext } from "vscode";
import { Logger } from "../Logger";
import { WorkspaceStateManager } from "../panels/WorkspaceStateManager";
import { generateWorkspaceFingerprint } from "../utilities/fingerprint";
import { buildAndroid } from "./buildAndroid";
import { buildIos } from "./buildIOS";
import fs from "fs";
import { calculateMD5 } from "../utilities/common";
import { IosBuild } from "../utilities/ios";
import { AndroidBuild } from "../utilities/android";

export class BuildManager {
  private workspaceDir: string;
  private iOSBuild: Promise<IosBuild> | undefined;
  private androidBuild: Promise<AndroidBuild> | undefined;
  private readonly workspaceStateManager: WorkspaceStateManager;

  constructor(workspaceDir: string, workspaceStateManager: WorkspaceStateManager) {
    this.workspaceDir = workspaceDir;
    this.workspaceStateManager = workspaceStateManager;

    // Populate fields from the cache data.
    const currentState = this.workspaceStateManager.getState();

    if (currentState.buildCache?.iOS?.build) {
      this.iOSBuild = Promise.resolve(currentState.buildCache?.iOS?.build);
    }
    if (currentState.buildCache?.android?.build) {
      this.androidBuild = Promise.resolve(currentState.buildCache?.android?.build);
    }
  }

  public getAndroidBuild() {
    return this.androidBuild;
  }

  public getIosBuild() {
    return this.iOSBuild;
  }

  private async _prepareAndroidBuild(newFingerprint?: string | undefined) {
    const buildHash = this.workspaceStateManager.getState().buildCache?.android?.buildHash;
    const cachedFingerprint =
      this.workspaceStateManager.getState().buildCache?.android?.fingerprintHash;
    const fingerprintMatching = newFingerprint === cachedFingerprint && !!cachedFingerprint;

    if (fingerprintMatching && this.androidBuild) {
      const build = await this.androidBuild;

      // We have to check if the user removed the build that was cached.
      if (fs.existsSync(build.apkPath)) {
        const hash = (await calculateMD5(build.apkPath)).digest("hex");

        if (hash === buildHash) {
          Logger.log("Cache hit on android build. Using existing build.");
          this.handleFinishedAndroidBuild(build, newFingerprint);
          return build;
        }
      }
    }

    const build = buildAndroid(this.workspaceDir);
    this.handleFinishedAndroidBuild(build, newFingerprint);
    return build;
  }

  private async handleFinishedAndroidBuild(
    buildPromise: Promise<AndroidBuild> | AndroidBuild,
    newFingerprint: string | undefined
  ) {
    try {
      const buildResult = await buildPromise;
      const newHash = (await calculateMD5(buildResult.apkPath)).digest("hex");
      Logger.log("Android hash", newHash);
      this.workspaceStateManager.updateState((state: any) => ({
        ...state,
        buildCache: {
          ...state.buildCache,
          android: {
            build: buildResult,
            buildHash: newHash,
            fingerprintHash: newFingerprint,
          },
        },
      }));
    } catch (e) {
      this.workspaceStateManager.updateState((state: any) => ({
        ...state,
        buildCache: {
          ...state.buildCache,
          android: {},
        },
      }));
      throw e;
    }
  }

  private async _prepareIosBuild(newFingerprint?: string | undefined) {
    const buildHash = this.workspaceStateManager.getState().buildCache?.iOS?.buildHash;
    const cachedFingerprint = this.workspaceStateManager.getState().buildCache?.iOS?.fingerprintHash;
    const fingerprintMatching = newFingerprint === cachedFingerprint && !!cachedFingerprint;

    if (fingerprintMatching && this.iOSBuild) {
      const build = await this.iOSBuild;

      // We have to check if the user removed the build that was cached.
      if (fs.existsSync(build.appPath)) {
        const hash = (await calculateMD5(build.appPath)).digest("hex");

        if (hash === buildHash) {
          Logger.debug("Cache hit on ios build. Using existing build.");
          this.handleFinishedIosBuild(build, newFingerprint);
          return build;
        }
      }
    }

    const build = buildIos(this.workspaceDir);
    this.handleFinishedIosBuild(build, newFingerprint);
    return build;
  }

  private async handleFinishedIosBuild(
    buildPromise: Promise<IosBuild> | IosBuild,
    newFingerprint: string | undefined
  ) {
    try {
      const buildResult = await buildPromise;
      const newHash = (await calculateMD5(buildResult.appPath)).digest("hex");
      Logger.debug("IOS hash", newHash);
      this.workspaceStateManager.updateState((state: any) => ({
        ...state,
        buildCache: {
          ...state.buildCache,
          iOS: {
            build: buildResult,
            buildHash: newHash,
            fingerprintHash: newFingerprint,
          },
        },
      }));
    } catch (e) {
      this.workspaceStateManager.updateState((state: any) => ({
        ...state,
        buildCache: {
          ...state.buildCache,
          iOS: {},
        },
      }));
      throw e;
    }
  }

  public async startBuilding(forceCleanBuild: boolean) {
    if (forceCleanBuild) {
      Logger.debug("Start build (force clean build)");
      this.iOSBuild = this._prepareIosBuild();
      this.androidBuild = this._prepareAndroidBuild();
    } else {
      Logger.debug("Start build (using build cache)");
      const newFingerprintHash = await this._generateFingerprint();
      this.iOSBuild = this._prepareIosBuild(newFingerprintHash);
      this.androidBuild = this._prepareAndroidBuild(newFingerprintHash);
    }
  }

  private async _generateFingerprint() {
    try {
      return await generateWorkspaceFingerprint();
    } catch (e) {
      Logger.warn("Couldn't get the fingerprint of the app.");
      return undefined;
    }
  }
}
