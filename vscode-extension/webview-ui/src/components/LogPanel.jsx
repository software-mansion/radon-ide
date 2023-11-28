import { vscode } from "../utilities/vscode";
import "./LogPanel.css";

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

export default LogPanel;
