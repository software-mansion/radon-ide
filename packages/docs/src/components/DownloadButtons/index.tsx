import React from "react";
import styles from "./styles.module.css";
import HomeButton from "./HomeButton";

interface HomepageButtonsProps {
  vertical?: boolean;
}

const DownloadButtons = ({ vertical }: HomepageButtonsProps) => {
  return (
    <div className={vertical ? styles.verticalButtonContainer : styles.buttonContainer}>
      <HomeButton
        target="_blank"
        href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
        title="Download for VSCode"
        icon="vscode"
        vertical={vertical}
      />
      <HomeButton
        target="_blank"
        href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
        title="Download for Cursor"
        icon="cursor"
        vertical={vertical}
      />
    </div>
  );
};

export default DownloadButtons;
