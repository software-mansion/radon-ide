import { useState, useRef, useEffect, MouseEvent, forwardRef, RefObject } from "react";
import clamp from "lodash/clamp";
import { throttle } from "../../common/utils";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { keyboardEventToHID } from "../utilities/keyMapping";
import "./Preview.css";
import { useProject } from "../providers/ProjectProvider";
import {
  DeviceProperties, SupportedDevices,
} from "../utilities/consts";
import PreviewLoader from "./PreviewLoader";
import { useBuildErrorAlert, useBundleErrorAlert } from "../hooks/useBuildErrorAlert";
import Debugger from "./Debugger";
import { InspectData } from "../../common/Project";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

function cssPropertiesForDevice(device: DeviceProperties) {
  return {
    "--phone-screen-height": `${(device.screenHeight / device.frameHeight) * 100}%`,
    "--phone-screen-width": `${(device.screenWidth / device.frameWidth) * 100}%`,
    "--min-hight": `${650}px`,
    "--min-width": `${650 * (device.screenWidth / device.screenHeight)}px`,
    "--phone-mask-image": `url(${device.maskImage})`,
    "--phone-top": `${(device.offsetY / device.frameHeight) * 100}%`,
    "--phone-left": `${(device.offsetX / device.frameWidth) * 100}%`,
  } as const;
}

const MjpegImg = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  (props, ref) => {
    const { src, ...rest } = props;
    const img = (ref as RefObject<HTMLImageElement>).current;

    // The below effect implements the main logic of this component. The primary
    // reason we can't just use img tag with src directly, is that with mjpeg streams
    // the img, after being removed from the hierarchy, will keep the connection open.
    // As a consequence, after several reloads, we will end up maintaining multiple
    // open streams which causes the UI to lag.
    // To avoid this, we manually control src attribute of the img tag and reset it
    // when the src by changing first to an empty string. We also set empty src when
    // the component is unmounted.
    useEffect(() => {
      if (!img) {
        return;
      }
      img.src = "";
      img.src = src || "";
      return () => {
        img.src = "";
      };
    }, [img]);

    // The sole purpose of the below effect is to periodically call `decode` on the image
    // in order to detect when the stream connection is dropped. There seem to be no better
    // way to handle it apart from this. When `decode` fails, we reset the image source to
    // trigger a new connection.
    useEffect(() => {
      let timer: NodeJS.Timeout;

      let cancelled = false;
      async function checkIfImageLoaded() {
        if (img?.src) {
          try {
            // waits until image is ready to be displayed
            await img.decode();
          } catch {
            // Stream connection was dropped
            if (!cancelled) {
              const src = img.src;
              img.src = "";
              img.src = src;
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
    }, [img]);

    return <img ref={ref} {...rest} />;
  }
);

type Props = {
  isInspecting: boolean;
  setIsInspecting: (isInspecting: boolean) => void;
};

function Preview({ isInspecting, setIsInspecting }: Props) {
  const wrapperDivRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);

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
  const [inspectData, setInspectData] = useState<InspectData | null>(null);
  useEffect(() => {
    if (!isInspecting) {
      setInspectData(null);
    }
  }, [isInspecting]);

  type MouseMove = "Move" | "Down" | "Up";
  function sendTouch(event: MouseEvent<HTMLDivElement>, type: MouseMove) {
    const imgRect = previewRef.current!.getBoundingClientRect();
    const x = (event.clientX - imgRect.left) / imgRect.width;
    const y = (event.clientY - imgRect.top) / imgRect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    project.dispatchTouch(clampedX, clampedY, type);
  }

  function sendInspectUnthrottled(event: MouseEvent<HTMLDivElement>, type: MouseMove | "Leave") {
    if (type === "Leave") {
      setInspectData(null);
      return;
    }
    const imgRect = previewRef.current!.getBoundingClientRect();
    const x = (event.clientX - imgRect.left) / imgRect.width;
    const y = (event.clientY - imgRect.top) / imgRect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    project.inspectElementAt(clampedX, clampedY, type === "Down", setInspectData);
  }

  const sendInspect = throttle(sendInspectUnthrottled, 50);

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Move");
    } else if (isInspecting) {
      sendInspect(e, "Move", false);
    }
  }

  function onMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    wrapperDivRef.current!.focus();
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

  function onMouseUp(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Up");
    }
    setIsPressing(false);
  }

  function onMouseLeave(e: MouseEvent<HTMLDivElement>) {
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
    function keyEventHandler(e: KeyboardEvent) {
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

  const device = SupportedDevices.find((sd)=>{
    return sd.name === projectState?.selectedDevice?.name;
  });

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
      style={cssPropertiesForDevice(device!)}
      tabIndex={0} // allows keyboard events to be captured
      ref={wrapperDivRef}>
      {!isStarting && !hasBuildError && (
        <div className="phone-content" {...touchHandlers}>
          <MjpegImg
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
          <img src={device!.frameImage} className="phone-frame" />
        </div>
      )}
      {isStarting && !hasBuildError && (
        <div className="phone-content">
          <div className="phone-sized phone-screen phone-content-loading-overlay" />
          <div className="phone-sized phone-screen phone-content-loading ">
            <PreviewLoader />
          </div>
          <img src={device!.frameImage} className="phone-frame" />
        </div>
      )}
      {hasBuildError && (
        <div className="phone-content">
          <div className="phone-sized phone-screen extension-error-screen" />
          <img src={device!.frameImage} className="phone-frame" />
        </div>
      )}
    </div>
  );
}

export default Preview;
