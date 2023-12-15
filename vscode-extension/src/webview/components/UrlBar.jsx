import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";
import IconButton from "./IconButton";

function formatAppKey(url) {
  if (url.startsWith("preview://")) {
    return url.split("/").pop();
  }
  return url;
}

function UrlBar({ onRestart }) {
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
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={urlList.length < 2}
        onClick={() => {
          vscode.postMessage({
            command: "openUrl",
            url: urlList[1],
          });
        }}>
        <span className="codicon codicon-arrow-left" />
      </IconButton>
      <IconButton
        onClick={onRestart}
        tooltip={{
          label: "Reload the preview",
          side: "bottom",
        }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
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

export default UrlBar;
