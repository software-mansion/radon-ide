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

const devices = [
  {
    id: "ios-17-iphone-15pro",
    platform: "iOS",
    name: "iPhone 15 Pro – iOS 17",
    width: 1179,
    height: 2556,
    backgroundImage: iphone14,
  },
  {
    id: "android-33-pixel-7",
    platform: "Android",
    name: "Pixel 7 – Android 13",
    width: 412,
    height: 869,
    backgroundImage: pixel7,
  },
];

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
  const phoneContentClass = `phone-content-${device.platform === "Android" ? "android" : "ios"}`;
  return (
    <div className="phone-wrapper">
      <div className="phone-wrapper-wrapper">
        {previewURL && (
          <img
            src={previewURL}
            className={`phone-content ${phoneContentClass}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseUp}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
        )}
        {!previewURL && (
          <div
            style={{ width: device.width, height: device.height }}
            className={`phone-content ${phoneContentClass} phone-content-loading`}>
            <VSCodeProgressRing />
          </div>
        )}
        <img src={imageSrc(device.backgroundImage)} className="phone-frame" />
      </div>
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
  const [previewURL, setPreviewURL] = useState();
  const [isInspecing, setIsInspecting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewsList, setPreviewsList] = useState([]);
  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      console.log("MSG", message);
      switch (message.command) {
        case "deviceReady":
          if (message.deviceId == device.id) {
            setPreviewURL(message.previewURL);
          }
        case "previewsList":
          setPreviewsList(message.previews);
      }
    };
    window.addEventListener("message", listener);

    vscode.postMessage({
      command: "changeDevice",
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
      <VSCodeDropdown
        onChange={(e) => {
          setDevice(devices.find((d) => d.id === e.target.value));
          setPreviewURL(undefined);
          vscode.postMessage({
            commage: "changeDevice",
            deviceId: e.target.value,
          });
        }}>
        {devices.map((device) => (
          <VSCodeOption key={device.id} value={device.id}>
            {device.name}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
    </main>
  );
}
export default App;
