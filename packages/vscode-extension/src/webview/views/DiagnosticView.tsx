import "./View.css";
import "./DiagnosticView.css";
import Anchor from "../components/shared/Anchor";
import CheckIcon from "../components/icons/CheckIcon";
import CloseIcon from "../components/icons/CloseIcon";
import CloseGrayIcon from "../components/icons/CloseGrayIcon";
import { dependencyDescription, useDependencies } from "../providers/DependenciesProvider";
import ProgressRing from "../components/shared/ProgressRing";
import Tooltip from "../components/shared/Tooltip";
import Label from "../components/shared/Label";
import Button from "../components/shared/Button";
import { Platform } from "../providers/UtilsProvider";
import { Dependency, DependencyStatus } from "../../common/DependencyManager";

function DiagnosticView() {
  const { dependencies, runDiagnostics } = useDependencies();

  return (
    <div className="diagnostic-container">
      <Label>Common</Label>
      <DiagnosticItem label="Node.js" name="nodejs" info={dependencies.nodejs} />
      <DiagnosticItem
        label={`Package manager`}
        name="packageManager"
        info={dependencies.packageManager}
      />
      <DiagnosticItem label="Node Modules" name="nodeModules" info={dependencies.nodeModules} />
      <div className="diagnostic-section-margin" />

      <Label>Android</Label>
      <DiagnosticItem
        label="Android Emulator"
        name="androidEmulator"
        info={dependencies.androidEmulator}
      />
      <DiagnosticItem label="Android Directory" name="android" info={dependencies.android} />
      <div className="diagnostic-section-margin" />

      {Platform.OS === "macos" && (
        <>
          <Label>iOS</Label>
          <DiagnosticItem label="Xcode" name="xcode" info={dependencies.xcode} />
          <DiagnosticItem label="CocoaPods" name="cocoaPods" info={dependencies.cocoaPods} />
          <DiagnosticItem label="Ios Directory" name="ios" info={dependencies.ios} />
          <div className="diagnostic-section-margin" />
        </>
      )}

      <Label>Project related</Label>
      <DiagnosticItem label="React Native" name="reactNative" info={dependencies.reactNative} />
      <DiagnosticItem label="Expo" name="expo" info={dependencies.expo} />
      {Platform.OS === "macos" && (
        <DiagnosticItem label="Pods" name="pods" info={dependencies.pods} />
      )}
      <div className="diagnostic-section-margin" />

      <Label>Other</Label>
      <DiagnosticItem label="Expo Router" name="expoRouter" info={dependencies.expoRouter} />
      <DiagnosticItem label="Storybook" name="storybook" info={dependencies.storybook} />
      <DiagnosticItem label="eas-cli" name="easCli" info={dependencies.easCli} />
      <div className="diagnostic-section-margin" />

      <div className="diagnostic-button-container">
        <Button onClick={runDiagnostics} type="secondary">
          <span slot="start" className="codicon codicon-refresh" />
          Re-run checks
        </Button>
      </div>
    </div>
  );
}

interface DiagnosticItemProps {
  label: string;
  name: Dependency;
  info?: DependencyStatus;
  action?: React.ReactNode;
}

function DiagnosticItem({ label, name, info, action }: DiagnosticItemProps) {
  let error: string | undefined = undefined;
  let description: string | undefined = undefined;

  let icon = <ProgressRing />;
  if (info) {
    icon = {
      installed: <CheckIcon />,
      notInstalled: <CloseIcon />,
      installing: <ProgressRing />,
    }[info.status];

    if (info.isOptional && info.status === "notInstalled") {
      icon = <CloseGrayIcon />;
    }

    const messages = dependencyDescription(name);
    if (!info.isOptional && info.status === "notInstalled") {
      error = messages.error;
    }
    description = messages.info;
  }

  const details = info?.details ? `: ${info?.details}` : "";

  return (
    <div className="diagnostic-item-wrapper">
      <div className="diagnostic-item">
        <div className="diagnostic-icon">{icon}</div>
        <p className="diagnostic-item-text">{`${label}${details}`}</p>
        {description && (
          <Tooltip label={description} type="secondary" instant>
            <span className="diagnostic-item-info-icon codicon codicon-info" />
          </Tooltip>
        )}
      </div>
      {error && (
        <div className="diagnostic-error-wrapper">
          <DiagnosticError message={error} />
          {action}
        </div>
      )}
    </div>
  );
}

interface DiagnosticErrorProps {
  message?: string;
}

export function DiagnosticError({ message }: DiagnosticErrorProps) {
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
