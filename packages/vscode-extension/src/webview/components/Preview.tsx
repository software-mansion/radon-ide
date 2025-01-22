import { useState, useRef, useEffect, MouseEvent } from "react";
import clamp from "lodash/clamp";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Resizable } from "re-resizable";
import "./Preview.css";
import { useProject } from "../providers/ProjectProvider";
import {
  AndroidSupportedDevices,
  DeviceProperties,
  iOSSupportedDevices,
} from "../utilities/consts";
import PreviewLoader from "./PreviewLoader";
import { useBuildErrorAlert, useBundleErrorAlert } from "../hooks/useBuildErrorAlert";
import Debugger from "./Debugger";
import { useNativeRebuildAlert } from "../hooks/useNativeRebuildAlert";
import {
  Frame,
  InspectDataStackItem,
  ZoomLevelType,
  InspectStackData,
  MultimediaData,
} from "../../common/Project";
import { useResizableProps } from "../hooks/useResizableProps";
import ZoomControls from "./ZoomControls";
import { throttle } from "../../utilities/throttle";
import { Platform } from "../providers/UtilsProvider";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";
import DimensionsBox from "./DimensionsBox";
import ReplayUI from "./ReplayUI";
import MjpegImg from "../Preview/MjpegImg";
import { useKeyPresses } from "../Preview/hooks";
import Device from "../Preview/Device";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

function cssPropertiesForDevice(device: DeviceProperties, frameDisabled: boolean) {
  const frame = frameDisabled ? device.bezel : device.frame;

  return {
    "--phone-screen-height": `${(device.screenHeight / frame.height) * 100}%`,
    "--phone-screen-width": `${(device.screenWidth / frame.width) * 100}%`,
    "--phone-aspect-ratio": `${frame.width / frame.height}`,
    "--phone-top": `${(frame.offsetY / frame.height) * 100}%`,
    "--phone-left": `${(frame.offsetX / frame.width) * 100}%`,
    "--phone-mask-image": `url(${device.maskImage})`,
    "--bezel-mask-image": `url(${frame.image})`,
  } as const;
}

function TouchPointIndicator({ isPressing }: { isPressing: boolean }) {
  return <div className={`touch-indicator ${isPressing ? "pressed" : ""}`}></div>;
}

type Props = {
  isInspecting: boolean;
  setIsInspecting: (isInspecting: boolean) => void;
  inspectFrame: Frame | null;
  setInspectFrame: (inspectFrame: Frame | null) => void;
  setInspectStackData: (inspectStackData: InspectStackData | null) => void;
  onInspectorItemSelected: (item: InspectDataStackItem) => void;
  zoomLevel: ZoomLevelType;
  onZoomChanged: (zoomLevel: ZoomLevelType) => void;
  replayData: MultimediaData | undefined;
  onReplayClose: () => void;
};

interface Point {
  x: number;
  y: number;
}

function calculateMirroredTouchPosition(touchPoint: Point, anchorPoint: Point) {
  const { x: pointX, y: pointY } = touchPoint;
  const { x: mirrorX, y: mirrorY } = anchorPoint;
  const mirroredPointX = 2 * mirrorX - pointX;
  const mirroredPointY = 2 * mirrorY - pointY;
  const clampedX = clamp(mirroredPointX, 0, 1);
  const clampedY = clamp(mirroredPointY, 0, 1);
  return { x: clampedX, y: clampedY };
}

function Preview({
  isInspecting,
  setIsInspecting,
  inspectFrame,
  setInspectFrame,
  setInspectStackData,
  onInspectorItemSelected,
  zoomLevel,
  onZoomChanged,
  replayData,
  onReplayClose,
}: Props) {
  const currentMousePosition = useRef<MouseEvent<HTMLDivElement>>();
  const wrapperDivRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isMultiTouching, setIsMultiTouching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [touchPoint, setTouchPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const [anchorPoint, setAnchorPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const previewRef = useRef<HTMLImageElement>(null);
  const [showPreviewRequested, setShowPreviewRequested] = useState(false);
  const { dispatchKeyPress, clearPressedKeys } = useKeyPresses();

  const workspace = useWorkspaceConfig();
  const { projectState, project } = useProject();

  const isFrameDisabled = workspace.showDeviceFrame === false;

  const projectStatus = projectState.status;

  const hasBuildError = projectStatus === "buildError";
  const hasIncrementalBundleError = projectStatus === "incrementalBundleError";
  const hasBundleError = projectStatus === "bundleError";

  const debugPaused = projectStatus === "debuggerPaused";
  const debugException = projectStatus === "runtimeError";

  const previewURL = projectState.previewURL;

  const isStarting =
    hasBundleError || hasIncrementalBundleError || debugException
      ? false
      : !projectState || projectState.status === "starting";
  const showDevicePreview =
    projectState?.previewURL && (showPreviewRequested || (!isStarting && !hasBuildError));

  useBuildErrorAlert(hasBuildError);
  useBundleErrorAlert(hasBundleError || hasIncrementalBundleError);

  const openRebuildAlert = useNativeRebuildAlert();

  function getTouchPosition(event: MouseEvent<HTMLDivElement>) {
    const imgRect = previewRef.current!.getBoundingClientRect();
    const x = (event.clientX - imgRect.left) / imgRect.width;
    const y = (event.clientY - imgRect.top) / imgRect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    return { x: clampedX, y: clampedY };
  }

  function moveAnchorPoint(event: MouseEvent<HTMLDivElement>) {
    let { x: anchorX, y: anchorY } = anchorPoint;
    const { x: prevPointX, y: prevPointY } = touchPoint;
    const { x: newPointX, y: newPointY } = getTouchPosition(event);

    anchorX += newPointX - prevPointX;
    anchorY += newPointY - prevPointY;
    anchorX = clamp(anchorX, 0, 1);
    anchorY = clamp(anchorY, 0, 1);
    setAnchorPoint({ x: anchorX, y: anchorY });
  }

  type MouseMove = "Move" | "Down" | "Up";
  function sendTouch(event: MouseEvent<HTMLDivElement>, type: MouseMove) {
    if (shouldPreventFromSendingTouch) {
      return;
    }

    const { x, y } = getTouchPosition(event);
    project.dispatchTouches([{ xRatio: x, yRatio: y }], type);
  }

  function sendMultiTouchForEvent(event: MouseEvent<HTMLDivElement>, type: MouseMove) {
    const pt = getTouchPosition(event);
    sendMultiTouch(pt, type);
  }

  function sendMultiTouch(pt: Point, type: MouseMove) {
    if (shouldPreventFromSendingTouch) {
      return;
    }

    const secondPt = calculateMirroredTouchPosition(pt, anchorPoint);
    project.dispatchTouches(
      [
        { xRatio: pt.x, yRatio: pt.y },
        { xRatio: secondPt.x, yRatio: secondPt.y },
      ],
      type
    );
  }

  function sendInspectUnthrottled(
    event: MouseEvent<HTMLDivElement>,
    type: MouseMove | "Leave" | "RightButtonDown"
  ) {
    if (type === "Leave") {
      return;
    }
    const { x: clampedX, y: clampedY } = getTouchPosition(event);
    const requestStack = type === "Down" || type === "RightButtonDown";
    const showInspectStackModal = type === "RightButtonDown";
    project.inspectElementAt(clampedX, clampedY, requestStack, (inspectData) => {
      if (requestStack && inspectData?.stack) {
        if (showInspectStackModal) {
          setInspectStackData({
            requestLocation: { x: event.clientX, y: event.clientY },
            stack: inspectData.stack,
          });
        } else {
          // find first item w/o hide flag and open file
          const firstItem = inspectData.stack.find((item) => !item.hide);
          if (firstItem) {
            onInspectorItemSelected(firstItem);
          }
        }
      }
      setInspectFrame(inspectData.frame);
    });
  }

  const sendInspect = throttle(sendInspectUnthrottled, 50);
  function resetInspector() {
    setInspectFrame(null);
    setInspectStackData(null);
  }

  const shouldPreventInputEvents =
    debugPaused ||
    debugException ||
    hasBundleError ||
    hasIncrementalBundleError ||
    !showDevicePreview ||
    !!replayData;

  const shouldPreventFromSendingTouch = isInspecting || !!inspectFrame;

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isInspecting) {
      sendInspect(e, "Move", false);
    } else if (isMultiTouching) {
      setTouchPoint(getTouchPosition(e));
      isPanning && moveAnchorPoint(e);
      isPressing && sendMultiTouchForEvent(e, "Move");
    } else if (isPressing) {
      sendTouch(e, "Move");
    }
    currentMousePosition.current = e;
  }

  function onMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    wrapperDivRef.current!.focus();

    if (isInspecting) {
      sendInspect(e, e.button === 2 ? "RightButtonDown" : "Down", true);
    } else if (!inspectFrame) {
      if (e.button === 2) {
        sendInspect(e, "RightButtonDown", true);
      } else if (isMultiTouching) {
        setIsPressing(true);
        sendMultiTouchForEvent(e, "Down");
      } else {
        setIsPressing(true);
        sendTouch(e, "Down");
      }
    }
  }

  function onMouseUp(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isInspecting) {
      setIsInspecting(false);
    } else if (!isInspecting && inspectFrame) {
      // if element is highlighted, we clear it here and ignore first click (don't send it to device)
      resetInspector();
    } else if (isPressing) {
      if (isMultiTouching) {
        sendMultiTouchForEvent(e, "Up");
      } else {
        sendTouch(e, "Up");
      }
      setIsPressing(false);
    }
  }

  function onMouseEnter(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    wrapperDivRef.current!.focus();

    if (isPressing) {
      if (isMultiTouching) {
        sendMultiTouchForEvent(e, "Down");
      } else {
        sendTouch(e, "Down");
      }
    }

    currentMousePosition.current = e;
  }

  function onMouseLeave(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isPressing) {
      if (isMultiTouching) {
        sendMultiTouchForEvent(e, "Up");
      } else {
        sendTouch(e, "Up");
      }
      setIsPressing(false);
    }

    if (isInspecting) {
      // we force inspect event here to make sure no extra events are throttled
      // and will be dispatched later on
      sendInspect(e, "Leave", true);
    }
  }

  const touchHandlers = shouldPreventInputEvents
    ? {}
    : {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseEnter,
        onMouseLeave,
      };

  function onWrapperMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.button !== 2) {
      setIsPressing(true);
    }
  }

  function onWrapperMouseUp(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsPressing(false);
  }

  function onWrapperMouseLeave(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsPressing(false);
    setIsMultiTouching(false);
  }

  const wrapperTouchHandlers = shouldPreventInputEvents
    ? {}
    : {
        onMouseDown: onWrapperMouseDown,
        onMouseUp: onWrapperMouseUp,
        onMouseLeave: onWrapperMouseLeave,
      };

  useEffect(() => {
    // this is a fix that disables context menu on windows https://github.com/microsoft/vscode/issues/139824
    // there is an active backlog item that aims to change the behavior of context menu, so it might not be necessary
    // in the future https://github.com/microsoft/vscode/issues/225411
    function onContextMenu(e: any) {
      e.stopImmediatePropagation();
    }

    window.addEventListener("contextmenu", onContextMenu, true);

    function onBlurChange() {
      if (!document.hasFocus()) {
        setIsPanning(false);
        setIsMultiTouching(false);
        setIsPressing(false);
      }
      clearPressedKeys();
    }

    document.addEventListener("blur", onBlurChange, true);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("blur", onBlurChange, true);
    };
  }, []);

  useEffect(() => {
    function dispatchPaste(e: ClipboardEvent) {
      if (document.activeElement === wrapperDivRef.current) {
        e.preventDefault();

        const text = e.clipboardData?.getData("text");
        if (text) {
          project.dispatchPaste(text);
        }
      }
    }
    addEventListener("paste", dispatchPaste);
    return () => {
      removeEventListener("paste", dispatchPaste);
    };
  }, [project]);

  useEffect(() => {
    function keyEventHandler(e: KeyboardEvent) {
      if (shouldPreventInputEvents) {
        return;
      }

      if (document.activeElement === wrapperDivRef.current) {
        e.preventDefault();
        const isKeydown = e.type === "keydown";

        const isMultiTouchKey = Platform.select({
          macos: e.code === "AltLeft" || e.code === "AltRight",
          windows: e.code === "ControlLeft" || e.code === "ControlRight",
          linux: e.code === "ControlLeft" || e.code === "ControlRight",
        });

        const isPanningKey = e.code === "ShiftLeft" || e.code === "ShiftRight";

        if (isMultiTouchKey && isKeydown) {
          setAnchorPoint({ x: 0.5, y: 0.5 });
          setTouchPoint(getTouchPosition(currentMousePosition.current!));
          setIsMultiTouching(true);
        }

        if (isMultiTouchKey && !isKeydown) {
          sendMultiTouch(touchPoint, "Up");
          setIsPressing(false);
          setIsMultiTouching(false);
        }

        if (isPanningKey) {
          setIsPanning(isKeydown);
        }

        dispatchKeyPress(e);
      }
    }
    document.addEventListener("keydown", keyEventHandler);
    document.addEventListener("keyup", keyEventHandler);
    return () => {
      document.removeEventListener("keydown", keyEventHandler);
      document.removeEventListener("keyup", keyEventHandler);
    };
  }, [project, shouldPreventInputEvents]);

  useEffect(() => {
    if (projectStatus === "running") {
      project.addListener("needsNativeRebuild", openRebuildAlert);
      return () => {
        project.removeListener("needsNativeRebuild", openRebuildAlert);
      };
    }
  }, [project, openRebuildAlert, projectStatus]);

  const device = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
    return sd.modelId === projectState?.selectedDevice?.modelId;
  });

  const resizableProps = useResizableProps({
    wrapperDivRef,
    zoomLevel,
    setZoomLevel: onZoomChanged,
    device: device!,
  });

  const mirroredTouchPosition = calculateMirroredTouchPosition(touchPoint, anchorPoint);
  const normalTouchIndicatorSize = 33;
  const smallTouchIndicatorSize = 9;

  return (
    <>
      <div
        className="phone-wrapper"
        style={cssPropertiesForDevice(device!, isFrameDisabled)}
        tabIndex={0} // allows keyboard events to be captured
        ref={wrapperDivRef}
        {...wrapperTouchHandlers}>
        {showDevicePreview && (
          <Device device={device!} resizableProps={resizableProps}>
            <div className="touch-area" {...touchHandlers}>
              <MjpegImg
                src={previewURL}
                ref={previewRef}
                style={{
                  cursor: isInspecting ? "crosshair" : "default",
                }}
                className="phone-screen"
              />
              {replayData && <ReplayUI onClose={onReplayClose} replayData={replayData} />}

              {isMultiTouching && (
                <div
                  style={{
                    "--x": `${touchPoint.x * 100}%`,
                    "--y": `${touchPoint.y * 100}%`,
                    "--size": `${normalTouchIndicatorSize}px`,
                  }}>
                  <TouchPointIndicator isPressing={isPressing} />
                </div>
              )}
              {isMultiTouching && (
                <div
                  style={{
                    "--x": `${anchorPoint.x * 100}%`,
                    "--y": `${anchorPoint.y * 100}%`,
                    "--size": `${smallTouchIndicatorSize}px`,
                  }}>
                  <TouchPointIndicator isPressing={false} />
                </div>
              )}
              {isMultiTouching && (
                <div
                  style={{
                    "--x": `${mirroredTouchPosition.x * 100}%`,
                    "--y": `${mirroredTouchPosition.y * 100}%`,
                    "--size": `${normalTouchIndicatorSize}px`,
                  }}>
                  <TouchPointIndicator isPressing={isPressing} />
                </div>
              )}

              {!replayData && inspectFrame && (
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
                  {isInspecting && (
                    <DimensionsBox
                      device={device}
                      frame={inspectFrame}
                      wrapperDivRef={wrapperDivRef}
                    />
                  )}
                </div>
              )}
              {projectStatus === "refreshing" && (
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
            </div>
          </Device>
        )}
        {!showDevicePreview && !hasBuildError && (
          <Device device={device!} resizableProps={resizableProps}>
            <div className="phone-sized phone-content-loading-background" />
            <div className="phone-sized phone-content-loading ">
              <PreviewLoader onRequestShowPreview={() => setShowPreviewRequested(true)} />
            </div>
          </Device>
        )}
        {hasBuildError && (
          <Device device={device!} resizableProps={resizableProps}>
              <div className="phone-sized extension-error-screen" />
          </Device>
        )}
      </div>

      <div className="button-group-left-wrapper">
        <div className="button-group-left">
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomChanged={onZoomChanged}
            device={device}
            wrapperDivRef={wrapperDivRef}
          />
        </div>
      </div>
    </>
  );
}

export default Preview;
