import _ from "lodash";
import { Disposable } from "vscode";
import { BuildConfig } from "../common/BuildConfig";
import { Logger } from "../Logger";
import { BuildManagerInterface, BuildOptions, BuildResult } from "./BuildManager";
import { CancelToken } from "./cancelToken";

class BuildInProgress {
  private progressListeners: ((newProgress: number) => void)[] = [];

  constructor(
    public readonly buildConfig: BuildConfig,
    public readonly promise: Promise<BuildResult>,
    public readonly cancelToken: CancelToken
  ) {}

  public addProgressListener(listener: (newProgress: number) => void) {
    this.progressListeners.push(listener);
  }

  public removeProgressListener(listener: (newProgress: number) => void) {
    _.remove(this.progressListeners, (l) => l === listener);
    if (this.progressListeners.length <= 0) {
      this.cancelToken.cancel();
    }
  }

  public onProgress(newProgress: number) {
    for (const listener of this.progressListeners.slice()) {
      listener(newProgress);
    }
  }
}

/**
 * BatchingBuildManager is a wrapper around BuildManagerInterface that batches concurrent build requests
 * for the same build configuration. It ensures that only one build is in progress for a given configuration
 * at a time, and reuses the existing build promise if another request comes in for the same configuration.
 */
export class BatchingBuildManager implements BuildManagerInterface, Disposable {
  private buildsInProgress: Map<string, BuildInProgress> = new Map();

  constructor(private readonly wrappedBuildManager: BuildManagerInterface) {}

  private makeBuildKey(buildConfig: BuildConfig) {
    return `${buildConfig.platform}:${buildConfig.type}:${buildConfig.appRoot}`;
  }

  public focusBuildOutput(): void {
    this.wrappedBuildManager.focusBuildOutput();
  }

  public async buildApp(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult> {
    const { progressListener, cancelToken } = options;
    const buildKey = this.makeBuildKey(buildConfig);

    if (this.buildsInProgress.has(buildKey)) {
      Logger.debug("Build already in progress for this configuration, reusing the promise.");
      const existingBuild = this.buildsInProgress.get(buildKey);
      if (existingBuild) {
        existingBuild.addProgressListener(progressListener);
        cancelToken.onCancel(() => {
          existingBuild.removeProgressListener(progressListener);
        });
        return existingBuild.promise;
      }
    }

    const cancelTokenForBuild = new CancelToken();
    const buildInProgress = new BuildInProgress(
      buildConfig,
      this.wrappedBuildManager.buildApp(buildConfig, {
        cancelToken: cancelTokenForBuild,
        progressListener: (newProgress) => {
          buildInProgress.onProgress(newProgress);
        },
      }),
      cancelTokenForBuild
    );
    buildInProgress.addProgressListener(progressListener);
    cancelToken.onCancel(() => {
      buildInProgress.removeProgressListener(progressListener);
    });
    this.buildsInProgress.set(buildKey, buildInProgress);
    try {
      return await buildInProgress.promise;
    } finally {
      if (this.buildsInProgress.get(buildKey) === buildInProgress) {
        this.buildsInProgress.delete(buildKey);
      }
    }
  }

  public dispose() {
    for (const build of this.buildsInProgress.values()) {
      build.cancelToken.cancel();
    }
    this.buildsInProgress.clear();
    this.wrappedBuildManager.dispose();
  }
}
