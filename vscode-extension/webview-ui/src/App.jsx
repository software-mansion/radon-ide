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
function Preview({ previewURL, isInspecting }) {
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
      <img
        src={previewURL}
        className="phone-content"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
      <img src={imageSrc(iphone14)} className="phone-frame" />
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
  const [previewState, setPreviewState] = useState(undefined);
  const [previewURL, setPreviewURL] = useState();
  const [isInspecing, setIsInspecting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewsList, setPreviewsList] = useState([]);
  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      console.log("MSG", message);
      switch (message.command) {
        case "previewReady":
          setPreviewState("ready");
          setPreviewURL(message.previewURL);
          break;
        case "previewsList":
          setPreviewsList(message.previews);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  return (
    <main style={{ padding: 10 }}>
      <div style={{ marginBottom: 10 }}>
        <VSCodeButton
          onClick={() => {
            setPreviewState("loading");
            vscode.postMessage({
              command: "runCommand",
            });
          }}>
          ▶
        </VSCodeButton>
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

      {previewState === "loading" && <VSCodeProgressRing />}
      {previewURL && <Preview isInspecting={isInspecing} previewURL={previewURL} />}
    </main>
  );
}
export default App;
