import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import {
  ANDROID_CMDLINE_TOOLS_DOWNLOAD_URL,
  ANDROID_STUDIO_DOWNLOAD_URL,
  XCODE_DOWNLOAD_URL,
} from "../utilities/consts";
import { vscode } from "../utilities/vscode";
import Anchor from "./Anchor";
import "./DependenciesList.css";
import CheckIcon from "./icons/CheckIcon";
import CloseIcon from "./icons/CloseIcon";
import PlayIcon from "./icons/PlayIcon";
import { useDependencies } from "../providers/DependenciesProvider";

function ConditionalIcon({ condition }) {
  return condition ? (
    <CheckIcon className="checklist-icon" />
  ) : (
    <CloseIcon className="checklist-icon" />
  );
}

function InstallIosDependenciesButton({ iosDepsInstalling, setIosDepsInstalling }) {
  const handleClick = () => {
    setIosDepsInstalling(true);
    vscode.postMessage({
      command: "installIOSDependencies",
    });
  };

  return iosDepsInstalling ? (
    <span className="loading-spinner">
      <VSCodeProgressRing className="loading-spinner" />
    </span>
  ) : (
    <span className="play-button" onClick={handleClick}>
      <PlayIcon />
    </span>
  );
}

function DependenciesList() {
  const { dependencies, iosDepsInstalling, setIosDepsInstalling } = useDependencies();

  return (
    <ul>
      <li className="section-header">iOS</li>
      <li>
        <ConditionalIcon condition={dependencies.xcodebuild} />
        {dependencies.xcodebuild ? (
          <div>
            Xcode -&nbsp;<code>xcodebuild</code>.
          </div>
        ) : (
          <div>
            Xcode -&nbsp;<code>xcodebuild</code>&nbsp;is missing. You can download Xcode with{" "}
            <code>xcodebuild</code> <Anchor url={XCODE_DOWNLOAD_URL}>here</Anchor>.
          </div>
        )}
      </li>
      <li>
        <ConditionalIcon condition={dependencies.xcrun} />
        {dependencies.xcrun ? (
          <div>
            Xcode -&nbsp;<code>xcrun</code>.
          </div>
        ) : (
          <div>
            Xcode -&nbsp;<code>xcrun</code>&nbsp;is missing. You can download Xcode with{" "}
            <code>xcrun</code> <Anchor url={XCODE_DOWNLOAD_URL}>here</Anchor>.
          </div>
        )}
      </li>
      <li>
        <ConditionalIcon condition={dependencies.simctl} />
        {dependencies.simctl ? (
          <div>
            Xcode -&nbsp;<code>simctl</code>.
          </div>
        ) : (
          <div>
            Xcode -&nbsp;<code>simctl</code>&nbsp;is missing. You can download Xcode with&nbsp;
            <code>simctl</code>&nbsp;
            <Anchor url={XCODE_DOWNLOAD_URL}>here</Anchor>.
          </div>
        )}
      </li>
      <li>
        <ConditionalIcon condition={dependencies.podCli} />
        {dependencies.podCli ? (
          <div>
            CocoaPods&nbsp;<code>pod</code>&nbsp;package manager.
          </div>
        ) : (
          <div>
            CocoaPods&nbsp;<code>pod</code>&nbsp;package manager is missing. You can install it by
            running &nbsp;<code>sudo gem install cocoapods</code>&nbsp;&#40;If gem doesn&#39;t work,
            you can also run&nbsp;
            <code>brew install cocoapods</code>&#41;.
          </div>
        )}
      </li>
      <li>
        <ConditionalIcon condition={dependencies.iosDependencies} />
        {dependencies.iosDependencies ? (
          <div>IOS dependencies.</div>
        ) : (
          <div>
            IOS dependencies are missing. You can install them by running&nbsp;
            <code>pod install</code>&nbsp; inside the&nbsp;<code>ios</code>&nbsp;directory of your
            react-native project. Or you can just simply press the button&nbsp;
            <InstallIosDependenciesButton
              iosDepsInstalling={iosDepsInstalling}
              setIosDepsInstalling={setIosDepsInstalling}
            />
            &nbsp; , so we can install them for you.
          </div>
        )}
      </li>
      <li className="section-header">Android</li>
      <li>
        <ConditionalIcon condition={dependencies.androidEmulator} />
        {dependencies.androidEmulator ? (
          <div>Android Emulator</div>
        ) : (
          <div>
            Android Emulator not found. You can get it by installing Android Studio. You can get
            it&nbsp;
            <Anchor url={ANDROID_STUDIO_DOWNLOAD_URL}>here</Anchor>.
          </div>
        )}
      </li>
      <li>
        <ConditionalIcon condition={dependencies.sdkManager} />
        {dependencies.sdkManager ? (
          <div>Android SDK Manager</div>
        ) : (
          <div>
            Android SDK Manager is not installed. Without it, we won&apos;t be albe to manage
            Android System Images for you. You can download them&nbsp;
            <Anchor url={ANDROID_CMDLINE_TOOLS_DOWNLOAD_URL}>here</Anchor>.
            <br />
            <b>IMPORTANT:</b> Make sure to add them to the system PATH.
          </div>
        )}
      </li>
    </ul>
  );
}

export default DependenciesList;
