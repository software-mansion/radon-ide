import React from "react";
import styles from "./styles.module.css";
import HomeButton from "./HomeButton";

interface HomepageButtonsProps {
  isModal?: boolean;
}

const DownloadButtons = ({ isModal }: HomepageButtonsProps) => {
  return (
    <div className={isModal ? styles.modalButtonContainer : styles.buttonContainer}>
      <HomeButton
        target="_blank"
        href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
        title="Download for VSCode"
        icon="vscode"
        isModal={isModal}
      />
      <HomeButton
        target="_blank"
        href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
        title="Download for Cursor"
        icon="cursor"
        isModal={isModal}
      />
    </div>
  );
};

export default DownloadButtons;
