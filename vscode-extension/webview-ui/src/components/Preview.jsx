import { useState } from "react";
import { vscode } from "../utilities/vscode";
import { throttle } from "../utilities/common";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import './Preview.css';

function sendTouch(event, type) {
  const imgRect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - imgRect.left) / imgRect.width;
  const y = (event.clientY - imgRect.top) / imgRect.height;
  vscode.postMessage({
    command: "touch",
    xRatio: x,
    yRatio: y,
    type,
  });
}

function sendInspectUnthrottled(event, type) {
  const imgRect = event.target.getBoundingClientRect();
  const x = (event.clientX - imgRect.left) / imgRect.width;
  const y = (event.clientY - imgRect.top) / imgRect.height;
  vscode.postMessage({
    command: "inspect",
    xRatio: x,
    yRatio: y,
    type,
  });
}

const sendInspect = throttle(sendInspectUnthrottled, 50);

function Preview({
  previewURL,
  device,
  isInspecting,
  debugPaused,
  debugException,
  inspectData,
  setIsInspecting,
  setInspectData,
}) {
  const [isPressing, setIsPressing] = useState(false);
  function handleMouseMove(e) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Move");
    } else if (isInspecting) {
      sendInspect(e, "Move");
    }
  }
  function handleMouseDown(e) {
    e.preventDefault();
    if (isInspecting) {
      sendInspect(e, "Down", true);
      setIsInspecting(false);
    } else if (inspectData) {
      // if element is highlighted, we clear it here and ignore first click (don't send it to device)
      setInspectData(null);
    } else {
      setIsPressing(true);
      sendTouch(e, "Move");
    }
  }
  function handleMouseUp(e) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Up");
    }
    setIsPressing(false);
  }
  function handleMouseLeave(e) {
    e.preventDefault();
    if (isPressing) {
      handleMouseUp(e);
    }
    if (isInspecting) {
      // we force inspect event here to make sure no extra events are throttled
      // and will be dispatched later on
      sendInspect(e, "Leave", true);
      setInspectData(null);
    }
  }
  const inspectFrame = inspectData?.frame;
  return (
    <div className="phone-wrapper">
      {previewURL && (
        <div className="phone-content">
          <img
            src={previewURL}
            style={{
              cursor: isInspecting ? "crosshair" : "default",
            }}
            className={`phone-sized phone-screen`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
          {inspectFrame && (
            <div className="phone-sized phone-inspect-overlay">
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
          {debugPaused && (
            <div className="phone-sized phone-debug-overlay">
              <button
                className="continue-button"
                onClick={() => {
                  vscode.postMessage({
                    command: "debugResume",
                  });
                }}>
                Paused in debugger&nbsp;
                <span className="codicon codicon-debug-continue" />
              </button>
            </div>
          )}
          {debugException && (
            <div className="phone-sized phone-debug-overlay phone-exception-overlay">
              <button
                className="uncaught-button"
                onClick={() => {
                  vscode.postMessage({
                    command: "debugResume",
                  });
                }}>
                Uncaught exception&nbsp;
                <span className="codicon codicon-debug-continue" />
              </button>
            </div>
          )}

          <img src={device.backgroundImage} className="phone-frame" />
        </div>
      )}
      {!previewURL && (
        <div className="phone-content">
          <div className="phone-sized phone-screen phone-content-loading">
            <VSCodeProgressRing />
          </div>
          <img src={device.backgroundImage} className="phone-frame" />
        </div>
      )}
    </div>
  );
}

export default Preview;

  