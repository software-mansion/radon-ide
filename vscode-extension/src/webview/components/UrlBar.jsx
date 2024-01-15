import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";
import IconButton from "./shared/IconButton";

function UrlBar({ onRestart }) {
  const [urlList, setUrlList] = useState([{ name: "/", id: null }]);

  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      if (message.command === "navigationChanged") {
        // put new url at the top of the list and remove duplicates
        const newRecord = { displayName: message.displayName, id: message.id };
        setUrlList((urlList) => [
          newRecord,
          ...urlList.filter((record) => record.id !== newRecord.id),
        ]);
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
            command: "openNavigation",
            id: urlList[1].id,
          });
          // remove first item from the url list
          setUrlList((urlList) => urlList.slice(1));
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
            command: "openNavigation",
            id: e.target.value,
          });
        }}>
        {urlList.map((entry) => (
          <VSCodeOption key={entry.id} value={entry.id}>
            {entry.displayName}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
    </>
  );
}

export default UrlBar;
