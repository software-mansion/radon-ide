import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import HomepageButton from "@site/src/components/HomepageButton";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import SecondaryButton from "../../SecondaryButton";
import CloseIcon from "../../CloseIcon";
import HomeButton from "../../HomepageButton/HomeButton";

const StartScreen = () => {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  // i need the state to have the iframe unmouted when the dialog is closed to prevent google to track the video
  // and unnecessarily load a heavy iframe
  const [isOpen, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (dialogRef.current?.open && !isOpen) {
      dialogRef.current?.close();
    } else if (!dialogRef.current?.open && isOpen) {
      dialogRef.current?.showModal();
    }

    dialogRef.current?.addEventListener("close", handleDialogClose);
    return () => {
      dialogRef.current?.removeEventListener("close", handleDialogClose);
    };
  }, [isOpen]);

  const handleCTAClick = () => {
    track("Main CTA");
  };

  const handleDialogOpen = () => {
    track("Secondary CTA");
    setOpen(true);
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heading}>
          <p>
            <span className={styles.left}>Trusted by</span>
            <span className={styles.center}>24,000+ engineers</span> worldwide
          </p>
          <h1 className={styles.headingLabel}>
            The Best <span>IDE</span> <br /> for&nbsp;React Native & Expo
          </h1>
          <h2 className={styles.subheadingLabel}>
            Radon IDE extension turns your VSCode or Cursor editor <br /> into fully-featured IDE
            for faster and more efficient development
          </h2>
          <div className={styles.buttonContainer}>
            <div>
              <HomeButton
                target="_blank"
                href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
                title="Download for VSCode"
                icon="vscode"
                onClick={handleCTAClick}
              />
            </div>
            <div>
              <HomeButton
                target="_blank"
                href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
                title="Download for Cursor"
                icon="cursor"
                onClick={handleCTAClick}
              />
            </div>
          </div>
          <div className={styles.headingDisclaimer}>
            Try 30 days for free. No sign up or credit card required.
          </div>

          <div className={styles.gradient}>
            <div className={styles.imageContainer}>
              <img src="../img/hero_screenshot.png" className={styles.heroImage} />
              <SecondaryButton title="Watch the Demo" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default StartScreen;
