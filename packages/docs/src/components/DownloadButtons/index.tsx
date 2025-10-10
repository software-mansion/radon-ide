import React from "react";
import styles from "./styles.module.css";
import HomeButton from "./HomeButton";
import { track } from "@vercel/analytics";

interface HomepageButtonsProps {
  vertical?: boolean;
  trackFrom?: string;
}

const DownloadButtons = ({ vertical, trackFrom }: HomepageButtonsProps) => {
  const handleVSCodeCTAClick = () => {
    track(`${trackFrom}: Install in VSCode`);
  };
  const handleCursorCTAClick = () => {
    track(`${trackFrom}: Install in Cursor`);
  };

  return (
    <div className={`${styles.buttonContainer} ${vertical ? styles.vertical : ""}`}>
      <HomeButton
        target="_blank"
        href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
        title="Install in VSCode"
        icon="vscode"
        vertical={vertical}
        onClick={handleVSCodeCTAClick}
      />
      <HomeButton
        target="_blank"
        href="https://open-vsx.org/extension/swmansion/react-native-ide"
        title="Install in Cursor"
        icon="cursor"
        vertical={vertical}
        onClick={handleCursorCTAClick}
      />
    </div>
  );
};

export default DownloadButtons;
