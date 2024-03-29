import { useState, useRef, useEffect } from "react";
import clamp from "lodash/clamp";
import { throttle } from "../../common/utils";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { keyboardEventToHID } from "../utilities/keyMapping";
import "./Preview.css";
import { useProject } from "../providers/ProjectProvider";
import { Platform } from "../../common/DeviceManager";
import {
  ANDROID_DEVICE_GRAPHICAL_PROPERTIES,
  IOS_DEVICE_GRAPHICAL_PROPERTIES,
} from "../utilities/consts";
import PreviewLoader from "./PreviewLoader";
import { useBuildErrorAlert, useBundleErrorAlert } from "../hooks/useBuildErrorAlert";
import Debugger from "./Debugger";

function cssPropertiesForDevice(device) {
  return {
    "--phone-screen-height": `${(device.screenHeight / device.frameHeight) * 100}%`,
    "--phone-screen-width": `${(device.screenWidth / device.frameWidth) * 100}%`,
    "--min-hight": `${650}px`,
    "--min-width": `${650 * (device.screenWidth / device.screenHeight)}px`,
    "--phone-mask-image": `url(${device.maskImage})`,
    "--phone-top": `${(device.offsetY / device.frameHeight) * 100}%`,
    "--phone-left": `${(device.offsetX / device.frameWidth) * 100}%`,
  };
}

function Preview({ isInspecting, setIsInspecting }) {
  const wrapperDivRef = useRef(null);
  const [isPressing, setIsPressing] = useState(false);
  const previewRef = useRef(null);

  const { projectState, project } = useProject();

  const hasBuildError = projectState?.status === "buildError";
  const hasIncrementalBundleError = projectState?.status === "incrementalBundleError";
  const hasBundleError = projectState?.status === "bundleError";

  const debugPaused = projectState?.status === "debuggerPaused";
  const debugException = projectState?.status === "runtimeError";

  const previewURL = projectState?.previewURL;

  const isStarting =
    hasBundleError || hasIncrementalBundleError || debugException
      ? false
      : !projectState ||
        projectState.previewURL === undefined ||
        projectState.status === "starting";

  useBuildErrorAlert(hasBuildError);
  useBundleErrorAlert(hasBundleError || hasIncrementalBundleError);
  const [inspectData, setInspectData] = useState(null);
  useEffect(() => {
    if (!isInspecting) {
      setInspectData(null);
    }
  }, [isInspecting]);

  function sendTouch(event, type) {
    const imgRect = previewRef.current.getBoundingClientRect();
    const x = (event.clientX - imgRect.left) / imgRect.width;
    const y = (event.clientY - imgRect.top) / imgRect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    project.dispatchTouch(clampedX, clampedY, type);
  }

  function sendInspectUnthrottled(event, type) {
    if (type === "Leave") {
      setInspectData(null);
      return;
    }
    const imgRect = previewRef.current.getBoundingClientRect();
    const x = (event.clientX - imgRect.left) / imgRect.width;
    const y = (event.clientY - imgRect.top) / imgRect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    project.inspectElementAt(clampedX, clampedY, type === "Down", setInspectData);
  }

  const sendInspect = throttle(sendInspectUnthrottled, 50);

  function onMouseMove(e) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Move");
    } else if (isInspecting) {
      sendInspect(e, "Move", false);
    }
  }

  function onMouseDown(e) {
    e.preventDefault();
    wrapperDivRef.current.focus();
    if (isInspecting) {
      sendInspect(e, "Down", true);
      setIsInspecting(false);
    } else if (inspectData) {
      // if element is highlighted, we clear it here and ignore first click (don't send it to device)
      setInspectData(null);
    } else {
      setIsPressing(true);
      sendTouch(e, "Down");
    }
  }

  function onMouseUp(e) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Up");
    }
    setIsPressing(false);
  }

  function onMouseLeave(e) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Up");
      setIsPressing(false);
    }
    if (isInspecting) {
      // we force inspect event here to make sure no extra events are throttled
      // and will be dispatched later on
      sendInspect(e, "Leave", true);
    }
  }

  useEffect(() => {
    function keyEventHandler(e) {
      if (document.activeElement === wrapperDivRef.current) {
        e.preventDefault();
        const hidCode = keyboardEventToHID(e);
        project.dispatchKeyPress(hidCode, e.type === "keydown" ? "Down" : "Up");
      }
    }
    document.addEventListener("keydown", keyEventHandler);
    document.addEventListener("keyup", keyEventHandler);
    return () => {
      document.removeEventListener("keydown", keyEventHandler);
      document.removeEventListener("keyup", keyEventHandler);
    };
  }, [project]);

  const device =
    projectState?.selectedDevice?.platform === Platform.Android
      ? ANDROID_DEVICE_GRAPHICAL_PROPERTIES
      : IOS_DEVICE_GRAPHICAL_PROPERTIES;

  const inspectFrame = inspectData?.frame;

  const shouldPreventTouchInteraction =
    debugPaused ||
    debugException ||
    hasBundleError ||
    hasIncrementalBundleError ||
    projectState?.status === "refreshing";

  const touchHandlers = shouldPreventTouchInteraction
    ? {}
    : {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave,
      };

  return (
    <div
      className="phone-wrapper"
      style={cssPropertiesForDevice(device)}
      tabIndex={0} // allows keyboard events to be captured
      ref={wrapperDivRef}>
      {!isStarting && !hasBuildError && (
        <div className="phone-content" {...touchHandlers}>
          <img
            src={previewURL}
            ref={previewRef}
            style={{
              cursor: isInspecting ? "crosshair" : "default",
            }}
            className="phone-screen"
          />
          {inspectFrame && (
            <div className="phone-screen phone-inspect-overlay">
              <div
                className="inspect-area"
                style={{
                  left: `${inspectFrame.x * 100}%`,
                  top: `${inspectFrame.y * 100}%`,
                  width: `${inspectFrame.width * 100}%`,
                  height: `${inspectFrame.height * 100}%`,
                }}
              />
            </div>
          )}
          {projectState.status == "refreshing" && (
            <div className="phone-screen phone-refreshing-overlay">
              <VSCodeProgressRing />
              <div>Refreshing...</div>
            </div>
          )}
          {debugPaused && (
            <div className="phone-screen phone-debug-overlay">
              <Debugger />
            </div>
          )}
          {debugException && (
            <div className="phone-screen phone-debug-overlay phone-exception-overlay">
              <button className="uncaught-button" onClick={() => project.resumeDebugger()}>
                Uncaught exception&nbsp;
                <span className="codicon codicon-debug-continue" />
              </button>
            </div>
          )}
          {/* TODO: Add different label in case of bundle/incremental bundle error */}
          {hasBundleError && (
            <div className="phone-screen phone-debug-overlay phone-exception-overlay">
              <button
                className="uncaught-button"
                onClick={() => {
                  project.restart(false);
                }}>
                Bundle error&nbsp;
                <span className="codicon codicon-refresh" />
              </button>
            </div>
          )}
          {hasIncrementalBundleError && (
            <div className="phone-screen phone-debug-overlay phone-exception-overlay">
              <button className="uncaught-button" onClick={() => project.restart(false)}>
                Bundle error&nbsp;
                <span className="codicon codicon-refresh" />
              </button>
            </div>
          )}
          <img src={device.frameImage} className="phone-frame" />
        </div>
      )}
      {isStarting && !hasBuildError && (
        <div className="phone-content">
          <div className="phone-sized phone-screen phone-content-loading-overlay" />
          <div className="phone-sized phone-screen phone-content-loading ">
            <PreviewLoader />
          </div>
          <img src={device.frameImage} className="phone-frame" />
        </div>
      )}
      {hasBuildError && (
        <div className="phone-content">
          <div className="phone-sized phone-screen extension-error-screen" />
          <img src={device.frameImage} className="phone-frame" />
        </div>
      )}
    </div>
  );
}

export default Preview;
