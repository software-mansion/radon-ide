import { useState, useRef, useEffect, MouseEvent, WheelEvent } from "react";
import "./Preview.css";
import { clamp, debounce } from "lodash";
import { useProject } from "../providers/ProjectProvider";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceContants";
import PreviewLoader from "./PreviewLoader";
import {
  useBootErrorAlert,
  useBuildErrorAlert,
  useBundleErrorAlert,
} from "../hooks/useBuildErrorAlert";
import Debugger from "./Debugger";
import { useNativeRebuildAlert } from "../hooks/useNativeRebuildAlert";
import {
  Frame,
  InspectDataStackItem,
  ZoomLevelType,
  InspectStackData,
  InspectorState,
  MultimediaData,
} from "../../common/Project";
import { useResizableProps } from "../hooks/useResizableProps";
import ZoomControls from "./ZoomControls";
import { throttle } from "../../utilities/throttle";
import { Platform } from "../providers/UtilsProvider";
import DimensionsBox from "./DimensionsBox";
import ReplayUI from "./ReplayUI";
import MjpegImg from "../Preview/MjpegImg";
import { useKeyPresses } from "../Preview/hooks";
import Device from "../Preview/Device";
import RenderOutlinesOverlay from "./RenderOutlinesOverlay";
import DelayedFastRefreshIndicator from "./DelayedFastRefreshIndicator";

function TouchPointIndicator({ isPressing }: { isPressing: boolean }) {
  return <div className={`touch-indicator ${isPressing ? "pressed" : ""}`}></div>;
}

type Props = {
  inspectorState: string;
  setInspectorState: (inspectorState: InspectorState) => void;
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
  inspectorState,
  setInspectorState,
  inspectFrame,
  setInspectFrame,
  setInspectStackData,
  onInspectorItemSelected,
  zoomLevel,
  onZoomChanged,
  replayData,
  onReplayClose,
}: Props) {
  const currentMousePosition = useRef<MouseEvent<HTMLDivElement>>(null);
  const wrapperDivRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isMultiTouching, setIsMultiTouching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [touchPoint, setTouchPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const [anchorPoint, setAnchorPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const previewRef = useRef<HTMLImageElement>(null);
  const [showPreviewRequested, setShowPreviewRequested] = useState(false);
  const { dispatchKeyPress, clearPressedKeys } = useKeyPresses();

  const { projectState, project } = useProject();

  const projectStatus = projectState.status;

  const hasBuildError = projectStatus === "buildError";
  const hasBootError = projectStatus === "bootError";
  const hasBundlingError = projectStatus === "bundlingError";

  const debugPaused = projectState.isDebuggerPaused;
  const isRefreshing = projectState.isRefreshing;

  const previewURL = projectState.previewURL;

  const isStarting = hasBundlingError ? false : !projectState || projectState.status === "starting";
  const showDevicePreview =
    projectState?.previewURL &&
    (showPreviewRequested || (!isStarting && !hasBuildError && !hasBootError));

  useBuildErrorAlert(hasBuildError);
  useBootErrorAlert(hasBootError);
  useBundleErrorAlert(hasBundlingError);

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
    setAnchorPoint({
      x: anchorX,
      y: anchorY,
    });
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
        {
          xRatio: secondPt.x,
          yRatio: secondPt.y,
        },
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
            requestLocation: {
              x: event.clientX,
              y: event.clientY,
            },
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

  const shouldPreventInputEvents =
    debugPaused || isRefreshing || !showDevicePreview || !!replayData;

  const shouldPreventFromSendingTouch = inspectorState === "inspecting" || !!inspectFrame;

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (inspectorState === "inspecting") {
      sendInspect(e, "Move", false);
    } else if (isMultiTouching) {
      setTouchPoint(getTouchPosition(e));
      if (isPanning) {
        moveAnchorPoint(e);
      }
      if (isPressing) {
        sendMultiTouchForEvent(e, "Move");
      }
    } else if (isPressing) {
      sendTouch(e, "Move");
    }
    currentMousePosition.current = e;
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (shouldPreventFromSendingTouch) {
      return;
    }

    const { x, y } = getTouchPosition(e);

    project.dispatchWheel({ xRatio: x, yRatio: y }, e.deltaX, e.deltaY);
  }

  function onMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    wrapperDivRef.current!.focus();
    switch (inspectorState) {
      case "inspecting":
        sendInspect(e, e.button === 2 ? "RightButtonDown" : "Down", true);
        setInspectorState("selected");
        break;
      case "selected":
        setInspectorState("disabled");
        break;
      case "disabled":
        if (e.button === 2) {
          sendInspect(e, "RightButtonDown", true);
        } else if (isMultiTouching) {
          setIsPressing(true);
          sendMultiTouchForEvent(e, "Down");
        } else {
          setIsPressing(true);
          sendTouch(e, "Down");
        }
        break;
    }
  }

  function onMouseUp(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (inspectorState === "disabled" && isPressing) {
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

    if (inspectorState === "inspecting") {
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
        // one wheel scrub can generate multiple events, so we debounce it better experience
        onWheel: debounce(onWheel, 100),
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

  function onWrapperMouseWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  const wrapperTouchHandlers = shouldPreventInputEvents
    ? {}
    : {
        onMouseDown: onWrapperMouseDown,
        onMouseUp: onWrapperMouseUp,
        onWheel: onWrapperMouseWheel,
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
    function synchronizeClipboard(e: ClipboardEvent) {
      if (document.activeElement === wrapperDivRef.current) {
        e.preventDefault();

        const text = e.clipboardData?.getData("text");
        if (text) {
          project.dispatchPaste(text);
        } else {
          project.dispatchCopy();
        }
      }
    }

    addEventListener("paste", synchronizeClipboard);
    addEventListener("copy", synchronizeClipboard);
    return () => {
      removeEventListener("paste", synchronizeClipboard);
      removeEventListener("copy", synchronizeClipboard);
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
          setAnchorPoint({
            x: 0.5,
            y: 0.5,
          });
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
    if (projectState.hasStaleBuildCache) {
      openRebuildAlert();
    }
  }, [projectState.hasStaleBuildCache]);

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
                  cursor: inspectorState === "inspecting" ? "crosshair" : "default",
                }}
                className="phone-screen"
              />
              <RenderOutlinesOverlay />
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
                  {inspectorState === "inspecting" && (
                    <DimensionsBox
                      device={device}
                      frame={inspectFrame}
                      wrapperDivRef={wrapperDivRef}
                    />
                  )}
                </div>
              )}
              {isRefreshing && (
                <div className="phone-screen phone-refreshing-overlay">
                  <div>Project is performing Fast Refresh...</div>
                  <div>(screen is inactive until refresh is complete)</div>
                </div>
              )}
              {debugPaused && (
                <div className="phone-screen phone-debug-overlay">
                  <Debugger />
                </div>
              )}
            </div>
          </Device>
        )}
        {!showDevicePreview && !hasBuildError && !hasBootError && (
          <Device device={device!} resizableProps={resizableProps}>
            <div className="phone-sized phone-content-loading-background" />
            <div className="phone-sized phone-content-loading ">
              <PreviewLoader onRequestShowPreview={() => setShowPreviewRequested(true)} />
            </div>
          </Device>
        )}
        {(hasBuildError || hasBootError) && (
          <Device device={device!} resizableProps={resizableProps}>
            <div className="phone-sized extension-error-screen" />
          </Device>
        )}
      </div>

      {showDevicePreview && <DelayedFastRefreshIndicator isRefreshing={isRefreshing} />}

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
