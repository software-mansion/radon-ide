import assert from "assert";
import Sinon from "sinon";
import { describe, beforeEach, it } from "mocha";

import { BatchingBuildManager } from "./BatchingBuildManager";
import { DevicePlatform } from "../common/DeviceManager";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { CancelToken } from "./cancelToken";

describe("BatchingBuildManager", () => {
  let buildAppMock = Sinon.stub();
  let buildManagerMock = {
    buildApp: buildAppMock,
    focusBuildOutput: Sinon.stub(),
    dispose: Sinon.stub(),
  };
  const APP_ROOT = "appRoot";
  const APP_ROOT_2 = "appRoot_2";
  const BUILD_RESULT = "build result";
  const BUILD_RESULT_2 = "build result 2";
  const progressListener = () => {};

  beforeEach(() => {
    // setup build manager mock
    buildAppMock = Sinon.stub();
    buildManagerMock = {
      buildApp: buildAppMock,
      focusBuildOutput: Sinon.stub(),
      dispose: Sinon.stub(),
    };
  });

  it("should focus the build output of the wrapped build manager", () => {
    const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
    batchingBuildManager.focusBuildOutput();
    assert(buildManagerMock.focusBuildOutput.calledOnce);
  });

  it("should dispose the wrapped build manager", () => {
    const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
    batchingBuildManager.dispose();
    assert(buildManagerMock.dispose.calledOnce);
  });

  for (const platform of Object.values(DevicePlatform)) {
    const BUILD_CONFIG = {
      appRoot: APP_ROOT,
      type: BuildType.Local,
      platform,
    } as BuildConfig;
    const BUILD_CONFIG_2 = {
      appRoot: APP_ROOT_2,
      type: BuildType.Local,
      platform,
    } as BuildConfig;

    describe(`for ${platform}`, () => {
      it("should call the wrapped build manager's buildApp method", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const options = { progressListener, cancelToken: new CancelToken() };

        buildAppMock.resolves(BUILD_RESULT);
        const result = await batchingBuildManager.buildApp(BUILD_CONFIG, options);

        assert.strictEqual(result, BUILD_RESULT);
        assert(buildAppMock.calledOnceWith(BUILD_CONFIG));
      });

      it("should only call the wrapped build manager's buildApp method once for the same configuration", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const options = { progressListener, cancelToken: new CancelToken() };

        const { promise, resolve } = Promise.withResolvers();
        buildAppMock.returns(promise);

        // First call
        const result1 = batchingBuildManager.buildApp(BUILD_CONFIG, options);

        // Second call with the same configuration
        const result2 = batchingBuildManager.buildApp(BUILD_CONFIG, options);

        resolve(BUILD_RESULT);

        assert.strictEqual(await result1, BUILD_RESULT);
        assert.strictEqual(await result2, BUILD_RESULT);

        assert(buildAppMock.calledOnce);
      });

      it("should call the wrapped build manager's buildApp for each different config", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const options = { progressListener: () => {}, cancelToken: new CancelToken() };

        const { promise, resolve } = Promise.withResolvers();
        buildAppMock.returns(promise);

        // First call
        const result1 = batchingBuildManager.buildApp(BUILD_CONFIG, options);

        // Second call with the same configuration
        const result2 = batchingBuildManager.buildApp(BUILD_CONFIG_2, options);

        resolve(BUILD_RESULT);

        assert.strictEqual(await result1, BUILD_RESULT);
        assert.strictEqual(await result2, BUILD_RESULT);

        assert(buildAppMock.calledTwice);
        assert(buildAppMock.calledWith(BUILD_CONFIG));
        assert(buildAppMock.calledWith(BUILD_CONFIG_2));
      });

      it("should call the wrapped build manager a second time after the first build is completed", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const options = { progressListener, cancelToken: new CancelToken() };

        const { promise, resolve } = Promise.withResolvers();
        buildAppMock.returns(promise);

        // First call
        const result1 = batchingBuildManager.buildApp(BUILD_CONFIG, options);

        // Resolve the first promise
        resolve(BUILD_RESULT);

        assert.strictEqual(await result1, BUILD_RESULT);

        buildAppMock.resolves(BUILD_RESULT_2);

        // Second call after the first is resolved
        const result2 = batchingBuildManager.buildApp(BUILD_CONFIG, options);
        assert.strictEqual(await result2, BUILD_RESULT_2);
        assert(buildAppMock.calledTwice);
        assert(buildAppMock.alwaysCalledWith(BUILD_CONFIG));
      });

      it("should cancel the build in progress when the passed cancel token is cancelled", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const cancelToken = new CancelToken();
        const options = { progressListener, cancelToken };

        const { promise } = Promise.withResolvers();
        buildAppMock.returns(promise);

        // Start the build
        batchingBuildManager.buildApp(BUILD_CONFIG, options);

        // Cancel the token
        cancelToken.cancel();

        const passedCancelToken = buildAppMock.getCall(0).args[1].cancelToken;
        assert(
          passedCancelToken.cancelled,
          "The cancel token passed to the wrapped BuildManager should be marked as cancelled"
        );
      });

      it("should not cancel the build in progress not all passed cancel tokens are cancelled", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const cancelToken = new CancelToken();

        const { promise } = Promise.withResolvers();
        buildAppMock.returns(promise);

        // Start the build
        batchingBuildManager.buildApp(BUILD_CONFIG, { progressListener, cancelToken });
        batchingBuildManager.buildApp(BUILD_CONFIG, {
          progressListener,
          cancelToken: new CancelToken(),
        });

        // Cancel the token
        cancelToken.cancel();

        assert(buildAppMock.calledOnce, "The wrapped BuildManager should be called only once");
        const passedCancelToken = buildAppMock.getCall(0).args[1].cancelToken;
        assert(
          !passedCancelToken.cancelled,
          "The cancel token passed to the wrapped BuildManager should be not marked as cancelled"
        );
      });

      it("should start new build when forceCleanBuild is passed", async () => {
        const batchingBuildManager = new BatchingBuildManager(buildManagerMock);
        const options = { progressListener, cancelToken: new CancelToken() };

        const { promise, resolve } = Promise.withResolvers();
        buildAppMock.returns(promise);

        // First call
        const result1 = batchingBuildManager.buildApp(BUILD_CONFIG, options);

        const { promise: promise2, resolve: resolve2 } = Promise.withResolvers();
        buildAppMock.returns(promise2);

        // Second call with the same configuration but forceCleanBuild is true
        const result2 = batchingBuildManager.buildApp(
          { ...BUILD_CONFIG, forceCleanBuild: true },
          options
        );

        resolve(BUILD_RESULT);
        resolve2(BUILD_RESULT_2);

        assert.strictEqual(await result1, BUILD_RESULT);
        assert.strictEqual(await result2, BUILD_RESULT_2);

        assert(buildAppMock.calledTwice);
      });
    });
  }
});
