import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import HomepageButton from "@site/src/components/HomepageButton";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";
import SecondaryButton from "../../SecondaryButton";
import CloseIcon from "../../CloseIcon";

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
        <motion.div
          className={styles.heroImageContainer}
          initial={{ x: 16 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.5 }}>
          <div className={styles.heroImageWrapper}>
            <img
              className={styles.heroImage}
              src={useBaseUrl("/img/hero.webp")}
              alt="IDE for React Native"
              width={1678}
              height={1025}
              draggable={false}
            />
          </div>
        </motion.div>
        <div className={styles.heading}>
          <motion.div
            className={styles.poweredBy}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}>
            <img src={useBaseUrl("/img/logo.svg")} alt="Radon IDE logo" className={styles.logo} />
            <p>by</p>
            <a href="https://swmansion.com" target="_blank" className={styles.swmLogoWrapper}>
              <img
                src={useBaseUrl("/img/swm-logo.svg")}
                alt="Software Mansion"
                className={styles.swmLogo}
              />
            </a>
          </motion.div>
          <motion.h1
            className={styles.headingLabel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}>
            The Best <span>IDE</span> for&nbsp;React Native
            <motion.div
              initial={{ x: 0, opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 1, 0], x: 600 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className={styles.headingSwoosh}
            />
          </motion.h1>
          <motion.h2
            className={styles.subheadingLabel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}>
            Radon IDE is a VSCode and Cursor extension that turns your editor into a fully featured
            IDE for React Native and Expo.
          </motion.h2>
          <div className={styles.buttonContainer}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}>
              <HomepageButton
                target="_blank"
                href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
                title="Get started for free"
                onClick={handleCTAClick}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}>
              <SecondaryButton title="Watch demo" onClick={handleDialogOpen} />
            </motion.div>
          </div>
          <motion.div
            className={styles.headingDisclaimer}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}>
            Free 30-day trial. No sign up or credit card required.
          </motion.div>
        </div>
      </section>
      {isOpen && (
        <dialog ref={dialogRef} onClick={handleDialogClose}>
          <button onClick={handleDialogClose} className={styles.dialogCloseButton}>
            <CloseIcon />
          </button>
          <iframe
            className={styles.responsiveIframe}
            width="1280"
            height="720"
            loading="lazy"
            src="https://www.youtube.com/embed/07Un9EfE8D4?si=h1-7o5e3StOjRZf8"
            title="YouTube video player"
            // @ts-ignore it's a valid attribute & type, typescript is wrong
            allowFullScreen="1"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </dialog>
      )}
    </>
  );
};

export default StartScreen;
