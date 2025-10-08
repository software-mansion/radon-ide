import React from "react";
import styles from "./styles.module.css";
import HomeButton from "./HomeButton";

interface HomepageButtonsProps {
  vertical?: boolean;
}

const DownloadButtons = ({ vertical }: HomepageButtonsProps) => {
  return (
    <div className={`${styles.buttonContainer} ${vertical ? styles.vertical : ""}`}>
      <HomeButton
        target="_blank"
        href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
        title="Install in VSCode"
        icon="vscode"
        vertical={vertical}
      />
      <HomeButton
        target="_blank"
        href="https://open-vsx.org/extension/swmansion/react-native-ide"
        title="Install in Cursor"
        icon="cursor"
        vertical={vertical}
      />
    </div>
  );
};

export default DownloadButtons;
