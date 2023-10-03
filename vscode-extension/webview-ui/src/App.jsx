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

function Preview({ previewURL, device, isInspecting }) {
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
            className={`phone-sized phone-screen`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseUp}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
          <img src={imageSrc(device.backgroundImage)} className="phone-frame" />
        </div>
      )}
      {!previewURL && (
        <div className="phone-content">
          <img src={imageSrc(device.backgroundImage)} className="phone-frame" />
          <div className="phone-sized phone-screen phone-content-loading">
            <VSCodeProgressRing />
          </div>
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
function App() {
  const [device, setDevice] = useState(devices[0]);
  const [deviceSettings, setDeviceSettings] = useState({
    appearance: "dark",
    contentSize: "normal",
  });
  const [previewURL, setPreviewURL] = useState();
  const [isInspecing, setIsInspecting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewsList, setPreviewsList] = useState([]);
  useEffect(() => {
    setCssPropertiesForDevice(device);

    const listener = (event) => {
      const message = event.data;
      console.log("MSG", message);
      switch (message.command) {
        case "appReady":
          setPreviewURL(message.previewURL);
        case "previewsList":
          setPreviewsList(message.previews);
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
      <div style={{ margin: 10 }}>
        <VSCodeButton
          appearance={isInspecing ? "primary" : "secondary"}
          onClick={() => {
            if (isInspecing) {
              vscode.postMessage({
                command: "stopInspecting",
              });
            }
            setIsInspecting(!isInspecing);
          }}>
          Inspect
        </VSCodeButton>
        <VSCodeButton
          appearance={isPreviewing ? "primary" : "secondary"}
          onClick={() => {
            vscode.postMessage({
              command: isPreviewing ? "stopPreview" : "startPreview",
            });
            setIsPreviewing(!isPreviewing);
          }}>
          Sync
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

      <Preview isInspecting={isInspecing} previewURL={previewURL} device={device} />
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
          <VSCodeOption value={"xsmall"}>Extra small</VSCodeOption>
          <VSCodeOption value={"small"}>Small</VSCodeOption>
          <VSCodeOption value={"normal"}>Normal</VSCodeOption>
          <VSCodeOption value={"large"}>Large</VSCodeOption>
          <VSCodeOption value={"xlarge"}>Extra large</VSCodeOption>
          <VSCodeOption value={"xxlarge"}>XX large</VSCodeOption>
          <VSCodeOption value={"xxxlarge"}>XXX large</VSCodeOption>
        </VSCodeDropdown>
      </div>
    </main>
  );
}
export default App;
