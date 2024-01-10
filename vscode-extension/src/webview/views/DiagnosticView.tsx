import "./View.css";
import "./DiagnosticView.css";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { vscode } from "../utilities/vscode";
import Anchor from "../components/Anchor";
import CheckIcon from "../components/icons/CheckIcon";
import CloseIcon from "../components/icons/CloseIcon";
import { DependencyData, useDependencies } from "../providers/DependenciesProvider";
import ProgressRing from "../components/ProgressRing";
import Tooltip from "../components/Tooltip";
import IconButton from "../components/IconButton";

function DiagnosticView() {
  const { dependencies, runDiagnostics } = useDependencies();

  return (
    <>
      <h3 className="diagnostic-label">Common</h3>
      <DiagnosticItem label="Node.js" item={dependencies.Nodejs} />

      <h3 className="diagnostic-label">Android</h3>
      <DiagnosticItem label="Android Studio" item={dependencies.AndroidStudio} />

      <h3 className="diagnostic-label">iOS</h3>
      <DiagnosticItem label="Xcode" item={dependencies.Xcode} />
      <DiagnosticItem label="CocoaPods" item={dependencies.CocoaPods} />

      <h3 className="diagnostic-label">Project related</h3>
      <DiagnosticItem
        label="Node modules installed"
        item={dependencies.NodeModules}
        action={
          <IconButton
            tooltip={{ label: "Fix", side: "bottom" }}
            type="secondary"
            size="small"
            onClick={() => {
              vscode.postMessage({
                command: "installNodeModules",
              });
            }}>
            <span className="codicon codicon-wand" />
          </IconButton>
        }
      />
      <DiagnosticItem
        label="Pods installed"
        item={dependencies.Pods}
        action={
          <IconButton
            tooltip={{ label: "Fix", side: "bottom" }}
            type="secondary"
            size="small"
            onClick={() => {
              vscode.postMessage({
                command: "installPods",
              });
            }}>
            <span className="codicon codicon-wand" />
          </IconButton>
        }
      />

      <div className="diagnostic-button-container">
        <VSCodeButton appearance="secondary" onClick={runDiagnostics}>
          <span slot="start" className="codicon codicon-refresh" />
          Re-run
        </VSCodeButton>
      </div>
    </>
  );
}

interface DiagnosticItemProps {
  label: string;
  item?: DependencyData;
  action?: React.ReactNode;
}

function DiagnosticItem({ label, item, action }: DiagnosticItemProps) {
  const icon = {
    true: <CheckIcon />,
    false: <CloseIcon />,
    undefined: <ProgressRing />,
  }[item?.installed?.toString() as "true" | "false" | "undefined"];

  return (
    <div className="diagnostic-item-wrapper">
      <div className="diagnostic-item">
        <div className="diagnostic-icon">{icon}</div>
        <p className="diagnostic-item-text">{label}</p>
        {item?.info && (
          <Tooltip label={item.info} type="secondary" instant>
            <span className="diagnostic-item-info-icon codicon codicon-info" />
          </Tooltip>
        )}
      </div>
      {item?.error && (
        <div className="diagnostic-error-wrapper">
          <DiagnosticError message={item?.error} />
          {action}
        </div>
      )}
    </div>
  );
}

interface DiagnosticErrorProps {
  message?: string;
}

function DiagnosticError({ message }: DiagnosticErrorProps) {
  if (!message) {
    return null;
  }
  const markdownLinkRegex = /\[(.*)\]\((.*)\)/;
  const result = message.match(markdownLinkRegex);

  if (!result) {
    return <p className="diagnostic-item-error">{message}</p>;
  }

  const [fullLink, title, url] = result;
  const [messageFirstPart, messageSecondPart] = message.split(fullLink);
  return (
    <p className="diagnostic-item-error">
      {messageFirstPart}
      <Anchor url={url}>{title}</Anchor>
      {messageSecondPart}
    </p>
  );
}

export default DiagnosticView;
