import {
  useState,
  useRef,
  useEffect,
  MouseEvent,
  forwardRef,
  RefObject,
  ReactNode,
  useCallback,
} from "react";
import clamp from "lodash/clamp";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Resizable } from "re-resizable";
import { keyboardEventToHID } from "../utilities/keyMapping";
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
  RecordingData,
  ZoomLevelType,
  InspectStackData,
} from "../../common/Project";
import { useResizableProps } from "../hooks/useResizableProps";
import ZoomControls from "./ZoomControls";
import { throttle } from "../../utilities/throttle";
import { Platform } from "../providers/UtilsProvider";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";
import DimensionsBox from "./DimensionsBox";
import ReplayUI from "./ReplayUI";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

const HIDE_ZOOM_CONTROLS_DELAY = 2000;

function useKeyPresses() {
  const pressedKeys = useRef(new Set<number>());
  const { project } = useProject();

  const dispatchKeyPress = useCallback((e: KeyboardEvent) => {
    const isKeydown = e.type === "keydown";
    const hidCode = keyboardEventToHID(e);

    if (hidCode) {
      if (isKeydown) {
        pressedKeys.current.add(hidCode);
      } else {
        pressedKeys.current.delete(hidCode);
      }

      project.dispatchKeyPress(hidCode, isKeydown ? "Down" : "Up");
    } else {
      console.warn(`Unrecognized keyboard input: ${e.code}`);
    }
  }, []);

  const clearPressedKeys = useCallback(() => {
    for (const keyCode of pressedKeys.current) {
      project.dispatchKeyPress(keyCode, "Up");
    }
    pressedKeys.current.clear();
  }, []);

  return {
    dispatchKeyPress,
    clearPressedKeys,
  };
}

function cssPropertiesForDevice(device: DeviceProperties, frameDisabled: boolean) {
  return {
    "--phone-screen-height": `${
      frameDisabled ? 100 : (device.screenHeight / device.frameHeight) * 100
    }%`,
    "--phone-screen-width": `${
      frameDisabled ? 100 : (device.screenWidth / device.frameWidth) * 100
    }%`,
    "--phone-aspect-ratio": `${
      frameDisabled
        ? device.screenWidth / device.screenHeight
        : device.frameWidth / device.frameHeight
    }`,
    "--phone-top": `${frameDisabled ? 0 : (device.offsetY / device.frameHeight) * 100}%`,
    "--phone-left": `${frameDisabled ? 0 : (device.offsetX / device.frameWidth) * 100}%`,
    "--phone-mask-image": `url(${device.maskImage})`,
  } as const;
}

const NO_IMAGE_DATA = "data:,";

const MjpegImg = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  (props, ref) => {
    const { src, ...rest } = props;

    // The below effect implements the main logic of this component. The primary
    // reason we can't just use img tag with src directly, is that with mjpeg streams
    // the img, after being removed from the hierarchy, will keep the connection open.
    // As a consequence, after several reloads, we will end up maintaining multiple
    // open streams which causes the UI to lag.
    // To avoid this, we manually control src attribute of the img tag and reset it
    // when the src by changing first to an empty string. We also set empty src when
    // the component is unmounted.
    useEffect(() => {
      const img = (ref as RefObject<HTMLImageElement>).current;
      if (!img) {
        return;
      }
      img.src = NO_IMAGE_DATA;
      img.src = src || NO_IMAGE_DATA;
      return () => {
        img.src = NO_IMAGE_DATA;
      };
    }, [ref, src]);

    // The sole purpose of the below effect is to periodically call `decode` on the image
    // in order to detect when the stream connection is dropped. There seem to be no better
    // way to handle it apart from this. When `decode` fails, we reset the image source to
    // trigger a new connection.
    useEffect(() => {
      let timer: NodeJS.Timeout;

      let cancelled = false;
      async function checkIfImageLoaded() {
        const img = (ref as RefObject<HTMLImageElement>).current;
        if (img?.src) {
          try {
            // waits until image is ready to be displayed
            await img.decode();
          } catch {
            // Stream connection was dropped
            if (!cancelled) {
              const srcCopy = img.src;
              img.src = NO_IMAGE_DATA;
              img.src = srcCopy;
            }
          }
        }
        if (!cancelled) {
          timer = setTimeout(checkIfImageLoaded, 2_000);
        }
      }
      checkIfImageLoaded();

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [ref]);

    return <img ref={ref} {...rest} />;
  }
);

type DeviceFrameProps = {
  device: DeviceProperties | undefined;
  isFrameDisabled: boolean;
};

function DeviceFrame({ device, isFrameDisabled }: DeviceFrameProps) {
  if (!device) {
    return null;
  }

  return (
    <img
      src={device.frameImage}
      className="phone-frame"
      style={{
        opacity: isFrameDisabled ? 0 : 1,
      }}
    />
  );
}

function TouchPointIndicator({ isPressing }: { isPressing: boolean }) {
  return <div className={`touch-indicator ${isPressing ? "pressed" : ""}`}></div>;
}

type ButtonGroupLeftProps = {
  children: ReactNode;
};

function ButtonGroupLeft({ children }: ButtonGroupLeftProps) {
  const [isMouseOver, setIsMouseOver] = useState(false);

  const hideButtonGroupTimeout = useRef<NodeJS.Timeout | undefined>();

  const onMouseOver = () => {
    clearTimeout(hideButtonGroupTimeout.current);
    setIsMouseOver(true);
  };

  const onMouseOut = () => {
    hideButtonGroupTimeout.current = setTimeout(() => {
      setIsMouseOver(false);
    }, HIDE_ZOOM_CONTROLS_DELAY);
  };

  return (
    <div onMouseOver={onMouseOver} onMouseOut={onMouseOut} className="button-group-left-container">
      <div
        style={isMouseOver ? { transform: "translateX(0px)" } : {}}
        className="button-group-left">
        {children}
      </div>
    </div>
  );
}

type Props = {
  isInspecting: boolean;
  inspectFrame: Frame | null;
  setInspectFrame: (inspectFrame: Frame | null) => void;
  setInspectStackData: (inspectStackData: InspectStackData | null) => void;
  onInspectorItemSelected: (item: InspectDataStackItem) => void;
  zoomLevel: ZoomLevelType;
  onZoomChanged: (zoomLevel: ZoomLevelType) => void;
  replayData: RecordingData | undefined;
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
    const { x, y } = getTouchPosition(event);
    project.dispatchTouches([{ xRatio: x, yRatio: y }], type);
  }

  function sendMultiTouchForEvent(event: MouseEvent<HTMLDivElement>, type: MouseMove) {
    const pt = getTouchPosition(event);
    sendMultiTouch(pt, type);
  }

  function sendMultiTouch(pt: Point, type: MouseMove) {
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

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isMultiTouching) {
      setTouchPoint(getTouchPosition(e));
      isPanning && moveAnchorPoint(e);
      isPressing && sendMultiTouchForEvent(e, "Move");
    } else if (isPressing) {
      sendTouch(e, "Move");
    } else if (isInspecting) {
      sendInspect(e, "Move", false);
    }
    currentMousePosition.current = e;
  }

  function onMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    wrapperDivRef.current!.focus();

    if (isInspecting) {
      sendInspect(e, e.button === 2 ? "RightButtonDown" : "Down", true);
    } else if (inspectFrame) {
      // if element is highlighted, we clear it here and ignore first click (don't send it to device)
      resetInspector();
    } else if (e.button === 2) {
      sendInspect(e, "RightButtonDown", true);
    } else if (isMultiTouching) {
      setIsPressing(true);
      sendMultiTouchForEvent(e, "Down");
    } else {
      setIsPressing(true);
      sendTouch(e, "Down");
    }
  }

  function onMouseUp(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isPressing) {
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
    setIsPressing(true);
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
          <Resizable {...resizableProps}>
            <div className="phone-content">
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
              <DeviceFrame device={device} isFrameDisabled={isFrameDisabled} />
            </div>
          </Resizable>
        )}
        {!showDevicePreview && !hasBuildError && (
          <Resizable {...resizableProps}>
            <div className="phone-content">
              <div className="phone-sized phone-content-loading-background" />
              <div className="phone-sized phone-content-loading ">
                <PreviewLoader onRequestShowPreview={() => setShowPreviewRequested(true)} />
              </div>
              <DeviceFrame device={device} isFrameDisabled={isFrameDisabled} />
            </div>
          </Resizable>
        )}
        {hasBuildError && (
          <Resizable {...resizableProps}>
            <div className="phone-content">
              <div className="phone-sized extension-error-screen" />
              <DeviceFrame device={device} isFrameDisabled={isFrameDisabled} />
            </div>
          </Resizable>
        )}
      </div>
      <ButtonGroupLeft>
        <ZoomControls
          zoomLevel={zoomLevel}
          onZoomChanged={onZoomChanged}
          device={device}
          wrapperDivRef={wrapperDivRef}
        />
      </ButtonGroupLeft>
    </>
  );
}

export default Preview;
