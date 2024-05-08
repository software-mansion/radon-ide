import "./View.css";
import "./DiagnosticView.css";
import { vscode } from "../utilities/vscode";
import Anchor from "../components/shared/Anchor";
import CheckIcon from "../components/icons/CheckIcon";
import CloseIcon from "../components/icons/CloseIcon";
import { DependencyData, useDependencies } from "../providers/DependenciesProvider";
import ProgressRing from "../components/shared/ProgressRing";
import Tooltip from "../components/shared/Tooltip";
import IconButton from "../components/shared/IconButton";
import Label from "../components/shared/Label";
import Button from "../components/shared/Button";

function DiagnosticView() {
  const { dependencies, runDiagnostics } = useDependencies();

  return (
    <>
      <Label>Common</Label>
      <DiagnosticItem label="Node.js" item={dependencies.Nodejs} />
      <div className="diagnostic-section-margin" />

      <Label>Android</Label>
      <DiagnosticItem label="Android Emulator" item={dependencies.AndroidEmulator} />
      <div className="diagnostic-section-margin" />

      <Label>iOS</Label>
      <DiagnosticItem label="Xcode" item={dependencies.Xcode} />
      <DiagnosticItem label="CocoaPods" item={dependencies.CocoaPods} />
      <div className="diagnostic-section-margin" />

      <Label>Project related</Label>
      <DiagnosticItem
        label="Pods installed"
        item={dependencies.Pods}
        action={
          <IconButton
            // TODO: support checking if Node Modules are installed and instaling them,
            // For now this condition is always true to allow usage of "Pods install" functionality.
            disabled={!dependencies.NodeModules?.installed || true}
            tooltip={{
              label: "Fix",
              side: "bottom",
            }}
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
      <div className="diagnostic-section-margin" />

      <div className="diagnostic-button-container">
        <Button onClick={runDiagnostics} type="secondary">
          <span slot="start" className="codicon codicon-refresh" />
          Re-run checks
        </Button>
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
