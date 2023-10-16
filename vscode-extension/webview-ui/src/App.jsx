import { vscode } from "./utilities/vscode";
import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import { useEffect, useState } from "react";

import iphone14 from "../../assets/iphone14.png";
import pixel7 from "../../assets/pixel7.png";
import { settings } from "cluster";

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

function Preview({ previewURL, device, isInspecting, debugPaused }) {
  const [isPressing, setIsPressing] = useState(false);
  function handleMouseMove(e) {
    e.preventDefault();
    if (isPressing) {
      sendTouch(e, "Move");
    }
  }
  function handleMouseDown(e) {
    e.preventDefault();
    if (isInspecting) {
      const imgRect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - imgRect.left) / imgRect.width;
      const y = (e.clientY - imgRect.top) / imgRect.height;
      vscode.postMessage({
        command: "inspect",
        xRatio: x,
        yRatio: y,
      });
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
            onMouseLeave={handleMouseUp}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
          {debugPaused && (
            <div className="phone-sized phone-debug-overlay">
              Paused in debugger
              <br />
              <VSCodeButton
                appearance={"primary"}
                onClick={() => {
                  vscode.postMessage({
                    command: "debugResume",
                  });
                }}>
                ⏵
              </VSCodeButton>
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
function PreviewsList({ previews, onSelect }) {
  return (
    <VSCodeDropdown
      onChange={(e) => {
        const selectedKey = e?.target?.value;
        vscode.postMessage({
          command: "selectPreview",
          appKey: selectedKey,
        });
      }}>
      {previews.map((preview) => (
        <VSCodeOption key={preview.appKey} value={preview.appKey}>
          {preview.name} {preview.props}
        </VSCodeOption>
      ))}
    </VSCodeDropdown>
  );
}
function LogPanel({ expandedLogs, logs }) {
  return (
    <div
      style={{
        width: 'calc(100% - 4px)',
        flex: expandedLogs ? '1 0 0%' : '0 0 0px',
        display: 'flex',
        justifyContent: 'flex-end',
        flexDirection: 'column',
        minHeight: expandedLogs ? "380px" : "0px",
        height: expandedLogs ? "auto" : "0px",
        border: expandedLogs ? "calc(var(--border-width) * 1px) solid var(--dropdown-border)" : "none",
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
              <div className="log-stack"
                style={{
                  backgroundColor: log.isFatal ? "red" : "transparent",
                  padding: "2px",
                  marginTop: "8px",
                }}>
                <div className="log-stack-text">{log.text}</div>
                {log.stack.map((entry, index) => (
                  !entry.collapse && (
                    <div
                      key={index}
                      style={{ color: "white", cursor: "pointer", marginBottom: '8px', }}
                      onClick={() => {
                        vscode.postMessage({
                          command: "openFile",
                          file: entry.fullPath,
                          lineNumber: entry.lineNumber,
                          column: entry.column,
                        });
                      }}>
                      <div>{entry.methodName}</div>
                      <div style={{ marginLeft: "24px" }}>{entry.file}:{entry.lineNumber}:{entry.column}</div>
                    </div>
                  )
                ))}
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

function App() {
  const [device, setDevice] = useState(devices[0]);
  const [deviceSettings, setDeviceSettings] = useState({
    appearance: "dark",
    contentSize: "normal",
  });
  const [previewURL, setPreviewURL] = useState();
  const [isInspecing, setIsInspecting] = useState(false);
  const [debugPaused, setDebugPaused] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [previewsList, setPreviewsList] = useState([]);
  const [appURL, setAppURL] = useState('/');
  useEffect(() => {
    setCssPropertiesForDevice(device);
  }, [device]);
  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      console.log("MSG", message);
      switch (message.command) {
        case "appReady":
          setPreviewURL(message.previewURL);
          break;
        case "previewsList":
          setPreviewsList(message.previews);
          break;
        case "debuggerPaused":
          setDebugPaused(true);
          break;
        case "debuggerResumed":
          setDebugPaused(false);
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
      <div className="button-group" style={{ marginBottom: 0 }}>
        <VSCodeButton
          appearance={isInspecing ? "primary" : "secondary"}
          onClick={() => {
            if (isInspecing) {
              vscode.postMessage({
                command: "stopInspecting",
              });
            }
            setIsInspecting(!isInspecing);
          }}
        >
          <span slot="start" class="codicon codicon-inspect" />
          Inspect
        </VSCodeButton>
        <VSCodeButton
          appearance={isPreviewing ? "primary" : "secondary"}
          onClick={() => {
            vscode.postMessage({
              command: isPreviewing ? "stopPreview" : "startPreview",
            });
            setIsPreviewing(!isPreviewing);
          }}
        >
          <span slot="start" class="codicon codicon-arrow-swap" />
          Sync
        </VSCodeButton>
        <VSCodeButton
          appearance={isFollowing ? "primary" : "secondary"}
          onClick={() => {
            vscode.postMessage({
              command: isFollowing ? "stopFollowing" : "startFollowing",
            });
            setIsFollowing(!isFollowing);
          }}
        >
          <span slot="start" class="codicon codicon-arrow-right" />
          Follow
        </VSCodeButton>
        {isPreviewing && false && previewsList.length > 0 && (
          <PreviewsList
            previews={previewsList}
            onSelect={(appKey) => {
              vscode.postMessage({
                command: "selectPreview",
                appKey,
              });
            }}
          />
        )}
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--dropdown-background)",
          height: "16px",
          textAlign: "start",
          verticalAlign: "middle",
          color: "var(--dropdown-foreground)",
          fontSize: "16px",
          margin: "8px",
          padding: "8px 0",
          paddingLeft: "8px",
          fontFamily: "var(--font-family)",
        }}
      >
        {appURL}
      </div>

      <Preview
        isInspecting={isInspecing}
        previewURL={previewURL}
        device={device}
        debugPaused={debugPaused}
      />
      <div class="button-group">
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
          <VSCodeOption value={"xsmall"}>Extra small</VSCodeOption>
          <VSCodeOption value={"small"}>Small</VSCodeOption>
          <VSCodeOption value={"normal"}>Normal</VSCodeOption>
          <VSCodeOption value={"large"}>Large</VSCodeOption>
          <VSCodeOption value={"xlarge"}>Extra large</VSCodeOption>
          <VSCodeOption value={"xxlarge"}>XX large</VSCodeOption>
          <VSCodeOption value={"xxxlarge"}>XXX large</VSCodeOption>
        </VSCodeDropdown>
        <VSCodeButton
          appearance={expandedLogs ? "primary" : "secondary"}
          onClick={() => setExpandedLogs(!expandedLogs)}>
          <span slot="start" class="codicon codicon-output" />
          Logs
        </VSCodeButton>
      </div>
      <LogPanel expandedLogs={expandedLogs} logs={logs} />
    </main>
  );
}
export default App;
