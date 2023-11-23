import { vscode } from "./utilities/vscode";
import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeProgressRing,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import { useEffect, useState } from "react";

import iphone14 from "../../assets/iphone14.png";
import pixel7 from "../../assets/pixel7.png";

const devices = [
  {
    id: "ios-17-iphone-15pro",
    platform: "iOS",
    name: "iPhone 15 Pro – iOS 17",
    width: 1179,
    height: 2556,
    backgroundImage: iphone14,
    backgroundMargins: [29, 33, 30, 36],
    backgroundSize: [1232, 608],
    backgroundBorderRadius: "12% / 6%",
  },
  {
    id: "android-33-pixel-7",
    platform: "Android",
    name: "Pixel 7 – Android 13",
    width: 412,
    height: 869,
    backgroundImage: pixel7,
    backgroundMargins: [58, 62, 62, 58],
    backgroundSize: [2541, 1200],
    backgroundBorderRadius: "4% / 2%",
  },
];

function setCssPropertiesForDevice(device) {
  // top right bottom left
  const m = device.backgroundMargins;
  const size = device.backgroundSize;
  document.documentElement.style.setProperty(
    "--phone-content-margins",
    `${((m[0] + m[2]) / size[0]) * 100}% 0% 0% ${(m[1] / size[1]) * 100}%`
  );

  document.documentElement.style.setProperty(
    "--phone-content-height",
    `${((size[0] - m[0] - m[2]) / size[0]) * 100}%`
  );
  document.documentElement.style.setProperty(
    "--phone-content-width",
    `${((size[1] - m[1] - m[3]) / size[1]) * 100}%`
  );
  document.documentElement.style.setProperty(
    "--phone-content-border-radius",
    device.backgroundBorderRadius
  );

  document.documentElement.style.setProperty(
    "--phone-content-aspect-ratio",
    `${device.width} / ${device.height}`
  );
}

console.log = function (...args) {
  vscode.postMessage({
    command: "log",
    text: args.map((arg) => JSON.stringify(arg)).join(" "),
  });
};

function imageSrc(imageName) {
  try {
    let baseUri = document.querySelector("base")?.getAttribute("href") || "";
    return baseUri.replace(/\/+$/, "") + "/" + imageName.replace(/^\/+/, "");
  } catch (e) {
    console.log("Error", imageName, window.baseUri);
    return "";
  }
}

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

function throttle(func, limit) {
  let timeout;
  let recentArgs;

  return function (...args) {
    const force = args[args.length - 1] === true; // Check if the last argument is true (force flag)

    if (force) {
      timeout = null;
      clearTimeout(timeout);
      func(...args);
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        func(...recentArgs);
        recentArgs = null;
      }, limit);
    }
    recentArgs = args;
  };
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
                <span class="codicon codicon-debug-continue" />
              </button>
            </div>
          )}
          {debugException && (
            <div className="phone-sized phone-debug-overlay phone-exception-overlay">
              <button
                class="uncaught-button"
                onClick={() => {
                  vscode.postMessage({
                    command: "debugResume",
                  });
                }}>
                Uncaught exception&nbsp;
                <span class="codicon codicon-debug-continue" />
              </button>
            </div>
          )}

          <img src={imageSrc(device.backgroundImage)} className="phone-frame" />
        </div>
      )}
      {!previewURL && (
        <div className="phone-content">
          <div className="phone-sized phone-screen phone-content-loading">
            <VSCodeProgressRing />
          </div>
          <img src={imageSrc(device.backgroundImage)} className="phone-frame" />
        </div>
      )}
    </div>
  );
}
function LogPanel({ expandedLogs, logs }) {
  return (
    <div
      style={{
        width: "calc(100% - 4px)",
        flex: expandedLogs ? "1 0 0%" : "0 0 0px",
        display: "flex",
        justifyContent: "flex-end",
        flexDirection: "column",
        minHeight: expandedLogs ? "380px" : "0px",
        height: expandedLogs ? "auto" : "0px",
        border: expandedLogs
          ? "calc(var(--border-width) * 1px) solid var(--dropdown-border)"
          : "none",
      }}>
      <div
        className="logs"
        style={{
          overflowY: "scroll",
          height: "100%",
        }}>
        {logs.map((log, index) => (
          <div key={index} className="log">
            {log.type === "stack" ? (
              <div
                className="log-stack"
                style={{
                  backgroundColor: log.isFatal ? "red" : "transparent",
                  padding: "2px",
                  marginTop: "8px",
                }}>
                <div className="log-stack-text">{log.text}</div>
                {log.stack.map(
                  (entry, index) =>
                    !entry.collapse && (
                      <div
                        key={index}
                        style={{ color: "white", cursor: "pointer", marginBottom: "8px" }}
                        onClick={() => {
                          vscode.postMessage({
                            command: "openFile",
                            file: entry.fullPath,
                            lineNumber: entry.lineNumber,
                            column: entry.column,
                          });
                        }}>
                        <div>{entry.methodName}</div>
                        <div style={{ marginLeft: "24px" }}>
                          {entry.file}:{entry.lineNumber}:{entry.column}
                        </div>
                      </div>
                    )
                )}
              </div>
            ) : (
              <div>{log.text}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAppKey(url) {
  if (url.startsWith("preview://")) {
    return url.split("/").pop();
  }
  return url;
}

function UrlBar() {
  const [urlList, setUrlList] = useState(["/"]);

  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      if (message.command === "appUrlChanged") {
        // put new url at the top of the list and remove duplicates
        const newUrl = message.url;
        setUrlList((urlList) => [newUrl, ...urlList.filter((url) => url !== newUrl)]);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  return (
    <>
      <VSCodeButton
        appearance={"secondary"}
        title="Go back"
        disabled={urlList.length < 2}
        onClick={() => {
          vscode.postMessage({
            command: "openUrl",
            url: urlList[1],
          });
        }}>
        <span class="codicon codicon-arrow-left" />
      </VSCodeButton>
      <VSCodeDropdown
        onChange={(e) => {
          vscode.postMessage({
            command: "openUrl",
            url: e.target.value,
          });
        }}>
        {urlList.map((url) => (
          <VSCodeOption key={url} value={url}>
            {formatAppKey(url)}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
    </>
  );
}

function LogCounter({ count }) {
  if (count <= 0) {
    return null;
  }
  return <span className="log-counter">{count}</span>;
}

function App() {
  const [device, setDevice] = useState(devices[0]);
  const [deviceSettings, setDeviceSettings] = useState({
    appearance: "dark",
    contentSize: "normal",
  });
  const [previewURL, setPreviewURL] = useState();
  const [isInspecing, setIsInspecting] = useState(false);
  const [debugPaused, setDebugPaused] = useState(false);
  const [debugException, setDebugException] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logCounter, setLogCounter] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [inspectData, setInspectData] = useState(null);
  const [appURL, setAppURL] = useState("/");
  useEffect(() => {
    setCssPropertiesForDevice(device);
  }, [device]);
  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      switch (message.command) {
        case "appReady":
          setPreviewURL(message.previewURL);
          break;
        case "inspectData":
          setInspectData(message.data);
          break;
        case "debuggerPaused":
          setDebugPaused(true);
          break;
        case "debuggerContinued":
          setDebugPaused(false);
          setDebugException(null);
          break;
        case "uncaughtException":
          setDebugException(message.isFatal ? "fatal" : "exception");
          break;
        case "logEvent":
          setLogCounter((logCounter) => logCounter + 1);
          break;
        case "consoleLog":
          setLogs((logs) => [{ type: "log", text: message.text }, ...logs]);
          break;
        case "consoleStack":
          setLogs((logs) => [
            {
              type: "stack",
              text: message.text,
              stack: message.stack,
              isFatal: message.isFatal,
            },
            ...logs,
          ]);
          break;
        case "appUrlChanged":
          setAppURL(message.url);
          break;
      }
    };
    window.addEventListener("message", listener);

    vscode.postMessage({
      command: "changeDevice",
      settings: deviceSettings,
      deviceId: device.id,
    });

    return () => window.removeEventListener("message", listener);
  }, []);
  return (
    <main>
      <div className="bar-spacer" />
      <Preview
        isInspecting={isInspecing}
        previewURL={previewURL}
        device={device}
        debugPaused={debugPaused}
        debugException={debugException}
        inspectData={inspectData}
        setIsInspecting={setIsInspecting}
        setInspectData={setInspectData}
      />
      <div className="bar-spacer" />

      <div className="button-group-top">
        <VSCodeButton
          appearance={isFollowing ? "primary" : "secondary"}
          title="Follow active editor on the device"
          onClick={() => {
            vscode.postMessage({
              command: isFollowing ? "stopFollowing" : "startFollowing",
            });
            setIsFollowing(!isFollowing);
          }}>
          <span class="codicon codicon-magnet" />
        </VSCodeButton>

        <span class="group-separator" />

        <UrlBar url={appURL} />

        <div class="spacer" />

        <VSCodeButton
          appearance={"secondary"}
          onClick={() => {
            setLogCounter(0);
            vscode.postMessage({ command: "openLogs" });
          }}>
          <span slot="start" class="codicon codicon-debug-console" />
          Logs
          <LogCounter count={logCounter} />
        </VSCodeButton>
      </div>

      <div class="button-group-bottom">
        <VSCodeButton
          appearance={isInspecing ? "primary" : "secondary"}
          onClick={() => {
            if (isInspecing) {
              setInspectData(null);
            }
            setIsInspecting(!isInspecing);
          }}>
          <span class="codicon codicon-inspect" />
        </VSCodeButton>

        <span class="group-separator" />

        <VSCodeDropdown
          onChange={(e) => {
            if (device.id !== e.target.value) {
              setDevice(devices.find((d) => d.id === e.target.value));
              setPreviewURL(undefined);
              vscode.postMessage({
                command: "changeDevice",
                settings: deviceSettings,
                deviceId: e.target.value,
              });
            }
          }}>
          <span slot="start" class="codicon codicon-device-mobile" />
          {devices.map((device) => (
            <VSCodeOption key={device.id} value={device.id}>
              {device.name}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>

        <div class="spacer" />

        <VSCodeDropdown
          value={deviceSettings.appearance}
          onChange={(e) => {
            const newSettings = { ...deviceSettings, appearance: e.target.value };
            setDeviceSettings(newSettings);
            vscode.postMessage({
              command: "changeDeviceSettings",
              settings: newSettings,
              deviceId: e.target.value,
            });
          }}>
          <span slot="start" class="codicon codicon-color-mode" />
          <VSCodeOption value={"light"}>Light</VSCodeOption>
          <VSCodeOption value={"dark"}>Dark</VSCodeOption>
        </VSCodeDropdown>

        <VSCodeDropdown
          value={deviceSettings.contentSize}
          onChange={(e) => {
            const newSettings = { ...deviceSettings, contentSize: e.target.value };
            setDeviceSettings(newSettings);
            vscode.postMessage({
              command: "changeDeviceSettings",
              settings: newSettings,
              deviceId: e.target.value,
            });
          }}>
          <span slot="start" class="codicon codicon-text-size" />
          <VSCodeOption value="xsmall">Extra small</VSCodeOption>
          <VSCodeOption value="small">Small</VSCodeOption>
          <VSCodeOption value="normal">Normal</VSCodeOption>
          <VSCodeOption value="large">Large</VSCodeOption>
          <VSCodeOption value="xlarge">Extra large</VSCodeOption>
          <VSCodeOption value="xxlarge">XX large</VSCodeOption>
          <VSCodeOption value="xxxlarge">XXX large</VSCodeOption>
        </VSCodeDropdown>
      </div>
      <LogPanel expandedLogs={expandedLogs} logs={logs} />
    </main>
  );
}
export default App;

// export default function App() {
//   return (<p>testasdfasdaf</p>)
// }