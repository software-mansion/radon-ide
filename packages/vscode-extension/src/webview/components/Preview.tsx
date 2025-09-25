import { useState, useRef, useEffect, MouseEvent, WheelEvent } from "react";
import { use$ } from "@legendapp/state/react";
import "./Preview.css";
import { clamp, debounce } from "lodash";
import { Platform, useProject } from "../providers/ProjectProvider";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceConstants";
import PreviewLoader from "./PreviewLoader";
import { useFatalErrorAlert } from "../hooks/useFatalErrorAlert";
import { useBundleErrorAlert } from "../hooks/useBundleErrorAlert";
import Debugger from "./Debugger";
import { useNativeRebuildAlert } from "../hooks/useNativeRebuildAlert";
import { Frame, InspectDataStackItem, InspectStackData } from "../../common/Project";
import ZoomControls from "./ZoomControls";
import { throttle } from "../../utilities/throttle";
import InspectOverlay from "./InspectOverlay";
import ReplayUI from "./ReplayUI";
import MjpegImg from "../Preview/MjpegImg";
import { useKeyPresses } from "../Preview/hooks";
import Device from "../Preview/Device";
import RenderOutlinesOverlay from "./RenderOutlinesOverlay";
import DelayedFastRefreshIndicator from "./DelayedFastRefreshIndicator";
import { previewToAppCoordinates } from "../utilities/transformAppCoordinates";
import { useStore } from "../providers/storeProvider";
import InspectorUnavailableBox from "./InspectorUnavailableBox";
import { useApplicationDisconnectedAlert } from "../hooks/useApplicationDisconnectedAlert";
import { SendFilesOverlay } from "./SendFilesOverlay";
import {
  InspectorAvailabilityStatus,
  InspectorBridgeStatus,
  MultimediaData,
  ZoomLevelType,
} from "../../common/State";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";

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
  replayData: MultimediaData | null | undefined;
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
  const store$ = useStore();
  const selectedDeviceSessionState = useSelectedDeviceSessionState();

  const rotation = use$(store$.workspaceConfiguration.deviceSettings.deviceRotation);

  const appOrientation = use$(selectedDeviceSessionState.applicationSession.appOrientation);
  const bundleError = use$(selectedDeviceSessionState.applicationSession.bundleError);
  const elementInspectorAvailability = use$(
    selectedDeviceSessionState.applicationSession.elementInspectorAvailability
  );
  const inspectorBridgeStatus = use$(
    selectedDeviceSessionState.applicationSession.inspectorBridgeStatus
  );
  const isUsingStaleBuild = use$(selectedDeviceSessionState.isUsingStaleBuild);
  const modelId = use$(selectedDeviceSessionState.deviceInfo.modelId);
  const selectedDeviceSessionStatus = use$(selectedDeviceSessionState.status);

  const currentMousePosition = useRef<MouseEvent<HTMLDivElement>>(null);
  const wrapperDivRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isMultiTouching, setIsMultiTouching] = useState(false);
  const [touchPoint, setTouchPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const [anchorPoint, setAnchorPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [showPreviewRequested, setShowPreviewRequested] = useState(false);
  const [inspectorUnavailableBoxPosition, setInspectorUnavailableBoxPosition] =
    useState<Point | null>(null);
  const { dispatchKeyPress, clearPressedKeys } = useKeyPresses();

  const { project } = useProject();

  const hasFatalError = selectedDeviceSessionStatus === "fatalError";

  const fatalErrorDescriptor = use$(() => {
    const store = selectedDeviceSessionState.get();
    return store && store.status === "fatalError" ? store.error : undefined;
  });

  const isRunning = selectedDeviceSessionStatus === "running";

  const isRefreshing = use$(() =>
    isRunning ? selectedDeviceSessionState.applicationSession.isRefreshing.get() : false
  );
  const debugPaused = use$(() =>
    isRunning ? selectedDeviceSessionState.applicationSession.isDebuggerPaused.get() : false
  );

  const previewURL = use$(selectedDeviceSessionState.previewURL);

  const showDevicePreview = previewURL && (showPreviewRequested || isRunning);

  const isAppDisconnected =
    isRunning && inspectorBridgeStatus === InspectorBridgeStatus.Disconnected;
  useApplicationDisconnectedAlert(isAppDisconnected);

  useFatalErrorAlert(fatalErrorDescriptor);

  const bundleErrorDescriptor = isRunning ? bundleError : null;
  useBundleErrorAlert(bundleErrorDescriptor);

  const openRebuildAlert = useNativeRebuildAlert();

  /**
   * Converts mouse event coordinates to normalized touch coordinates ([0-1] range)
   * relative to the device preview image.
   * Coordinate transformation handling when the device when the device is rotated,
   * done in the sendTouches method in preview.ts.
   */
  function getNormalizedTouchCoordinates(event: MouseEvent<HTMLDivElement>) {
    const imgRect = previewRef.current!.getBoundingClientRect();

    // Normalize coordinates to [0-1] range
    const x = (event.clientX - imgRect.left) / imgRect.width;
    const y = (event.clientY - imgRect.top) / imgRect.height;

    let clampedX = clamp(x, 0, 1);
    let clampedY = clamp(y, 0, 1);
    return { x: clampedX, y: clampedY };
  }

  function moveAnchorPoint(event: MouseEvent<HTMLDivElement>) {
    let { x: anchorX, y: anchorY } = anchorPoint;
    const { x: prevPointX, y: prevPointY } = touchPoint;
    const { x: newPointX, y: newPointY } = getNormalizedTouchCoordinates(event);
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

    const { x, y } = getNormalizedTouchCoordinates(event);
    project.dispatchTouches([{ xRatio: x, yRatio: y }], type);
  }

  function sendMultiTouchForEvent(event: MouseEvent<HTMLDivElement>, type: MouseMove) {
    const pt = getNormalizedTouchCoordinates(event);
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
    if (selectedDeviceSessionStatus !== "running") {
      return;
    }
    if (elementInspectorAvailability !== InspectorAvailabilityStatus.Available) {
      return;
    }
    if (type === "Leave") {
      return;
    }
    if (type === "RightButtonDown") {
      project.sendTelemetry("inspector:show-component-stack", {});
    }

    const clampedCoordinates = getNormalizedTouchCoordinates(event);
    const { x: translatedX, y: translatedY } = previewToAppCoordinates(
      appOrientation,
      rotation,
      clampedCoordinates
    );

    const requestStack = type === "Down" || type === "RightButtonDown";
    const showInspectStackModal = type === "RightButtonDown";
    project
      .inspectElementAt(translatedX, translatedY, requestStack)
      .then((inspectData) => {
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
        if (inspectData.frame) {
          setInspectFrame(inspectData.frame);
        }
      })
      .catch(() => {
        // NOTE: we can safely ignore errors, we'll simply not show the frame in that case
      });
  }

  const sendInspect = throttle(sendInspectUnthrottled, 50);

  function resetInspector() {
    setInspectFrame(null);
    setInspectStackData(null);
  }

  function handleInspectorUnavailable(event: MouseEvent<HTMLDivElement>) {
    if (inspectorUnavailableBoxPosition) {
      return;
    }
    const clampedCoordinates = getNormalizedTouchCoordinates(event);
    setInspectorUnavailableBoxPosition(clampedCoordinates);
  }

  const shouldPreventInputEvents =
    debugPaused || isRefreshing || !showDevicePreview || !!replayData;

  const shouldPreventFromSendingTouch = isInspecting || !!inspectFrame;

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isInspecting) {
      sendInspect(e, "Move", false);
    } else if (isMultiTouching) {
      setTouchPoint(getNormalizedTouchCoordinates(e));
      if (e.shiftKey) {
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

    const { x, y } = getNormalizedTouchCoordinates(e);

    project.dispatchWheel({ xRatio: x, yRatio: y }, e.deltaX, e.deltaY);
  }

  function onMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    wrapperDivRef.current!.focus();

    if (isInspecting) {
      sendInspect(e, e.button === 2 ? "RightButtonDown" : "Down", true);
    } else if (!inspectFrame) {
      if (e.button === 2) {
        if (
          selectedDeviceSessionStatus === "running" &&
          elementInspectorAvailability !== InspectorAvailabilityStatus.Available
        ) {
          handleInspectorUnavailable(e);
        } else {
          sendInspect(e, "RightButtonDown", true);
        }
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
    function onContextMenu(e: Event) {
      e.stopImmediatePropagation();
    }

    window.addEventListener("contextmenu", onContextMenu, true);

    function onBlurChange() {
      if (!document.hasFocus()) {
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

        if (isMultiTouchKey && isKeydown) {
          setAnchorPoint({
            x: 0.5,
            y: 0.5,
          });
          setTouchPoint(getNormalizedTouchCoordinates(currentMousePosition.current!));
          setIsMultiTouching(true);
        }

        if (isMultiTouchKey && !isKeydown) {
          sendMultiTouch(touchPoint, "Up");
          setIsPressing(false);
          setIsMultiTouching(false);
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
    if (isUsingStaleBuild) {
      openRebuildAlert();
    }
  }, [isUsingStaleBuild]);

  const device = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
    return sd.modelId === modelId;
  });

  const mirroredTouchPosition = calculateMirroredTouchPosition(touchPoint, anchorPoint);
  const normalTouchIndicatorSize = 33;
  const smallTouchIndicatorSize = 9;

  return (
    <>
      <div
        className="phone-display-container"
        data-testid="phone-display-container"
        tabIndex={0} // allows keyboard events to be captured
        ref={wrapperDivRef}
        {...wrapperTouchHandlers}>
        {showDevicePreview && (
          <Device device={device!} zoomLevel={zoomLevel} wrapperDivRef={wrapperDivRef}>
            <div className="touch-area" {...touchHandlers}>
              <MjpegImg
                src={previewURL}
                ref={previewRef}
                style={{
                  cursor: isInspecting ? "crosshair" : "default",
                }}
                className="phone-screen"
                data-testid="phone-screen"
              />
              <RenderOutlinesOverlay />
              {isRunning && <SendFilesOverlay />}
              {replayData && <ReplayUI onClose={onReplayClose} replayData={replayData} />}

              {isMultiTouching && (
                <div
                  style={
                    {
                      "--x": `${touchPoint.x * 100}%`,
                      "--y": `${touchPoint.y * 100}%`,
                      "--size": `${normalTouchIndicatorSize}px`,
                    } as React.CSSProperties
                  }>
                  <TouchPointIndicator isPressing={isPressing} />
                </div>
              )}
              {isMultiTouching && (
                <div
                  style={
                    {
                      "--x": `${anchorPoint.x * 100}%`,
                      "--y": `${anchorPoint.y * 100}%`,
                      "--size": `${smallTouchIndicatorSize}px`,
                    } as React.CSSProperties
                  }>
                  <TouchPointIndicator isPressing={false} />
                </div>
              )}
              {isMultiTouching && (
                <div
                  style={
                    {
                      "--x": `${mirroredTouchPosition.x * 100}%`,
                      "--y": `${mirroredTouchPosition.y * 100}%`,
                      "--size": `${normalTouchIndicatorSize}px`,
                    } as React.CSSProperties
                  }>
                  <TouchPointIndicator isPressing={isPressing} />
                </div>
              )}

              {!replayData && inspectFrame && (
                <InspectOverlay
                  inspectFrame={inspectFrame}
                  isInspecting={isInspecting}
                  device={device!}
                  wrapperDivRef={wrapperDivRef}
                />
              )}

              {inspectorUnavailableBoxPosition && (
                <InspectorUnavailableBox
                  clickPosition={inspectorUnavailableBoxPosition}
                  onClose={() => setInspectorUnavailableBoxPosition(null)}
                />
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
        {!showDevicePreview && selectedDeviceSessionStatus === "starting" && (
          <Device device={device!} zoomLevel={zoomLevel} wrapperDivRef={wrapperDivRef}>
            <div className="phone-sized phone-content-loading-background" />
            <div className="phone-sized phone-content-loading ">
              <PreviewLoader onRequestShowPreview={() => setShowPreviewRequested(true)} />
            </div>
          </Device>
        )}
        {hasFatalError && (
          <Device device={device!} zoomLevel={zoomLevel} wrapperDivRef={wrapperDivRef}>
            <div className="phone-sized extension-error-screen" />
          </Device>
        )}
      </div>

      {showDevicePreview && <DelayedFastRefreshIndicator isRefreshing={isRefreshing} />}

      <div className="button-group-left-wrapper" data-testid="button-group-left-wrapper">
        <div className="button-group-left">
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomChanged={onZoomChanged}
            device={device}
            wrapperDivRef={wrapperDivRef}
          />
        </div>
      </div>

      {/* Hack needed for css to cache those images. By default, all the images are not cached on the frontend,
      so without this in place, when the device rotates, the images are re-fetched from the file system
      which causes the device preview to flicker. */}
      <span className="phone-preload-masks">
        <div style={{ maskImage: `url(${device?.landscapeScreenMaskImage})` }} />
        <div style={{ maskImage: `url(${device?.screenMaskImage})` }} />
        <div style={{ maskImage: `url(${device?.bezel.imageLandscape})` }} />
        <div style={{ maskImage: `url(${device?.bezel.image})` }} />
        <div style={{ maskImage: `url(${device?.skin.imageLandscape})` }} />
        <div style={{ maskImage: `url(${device?.skin.image})` }} />

        <img src={device?.skin.image} alt="" />
        <img src={device?.skin.imageLandscape} alt="" />
        <img src={device?.bezel.image} alt="" />
        <img src={device?.bezel.imageLandscape} alt="" />
      </span>
    </>
  );
}

export default Preview;
