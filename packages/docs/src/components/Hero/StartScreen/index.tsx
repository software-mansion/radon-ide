import React from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";
import SecondaryButton from "../../SecondaryButton";
import CloseIcon from "../../CloseIcon";
import DownloadButtons from "@site/src/components/DownloadButtons";
import ThemedImage from "@theme/ThemedImage";
import useBaseUrl from "@docusaurus/useBaseUrl";

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

  const handleDialogOpen = () => {
    track("Secondary CTA");
    setOpen(true);
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  const sources = {
    light: useBaseUrl("/img/hero-light.webp"),
    dark: useBaseUrl("/img/hero-dark.webp"),
  };

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heading}>
          <p className={styles.preheadingLabel}>
            <span className={styles.left}>Trusted by</span>
            <span className={styles.center}>34,000+ engineers</span> worldwide
          </p>
          <h1 className={styles.headingLabel}>
            Build better <span className={styles.headingRN}>React Native & Expo</span> apps with
            Radon
          </h1>
          <h2 className={styles.subheadingLabel}>
            The VSCode & Cursor extension that turns your editor into a complete IDE (you'll
            actually enjoy using)<span className={styles.dot}>.</span>{" "}
            <p>
              Trusted by <span>34,000+ engineers worldwide</span>.
            </p>
          </h2>
          <div className={styles.buttonContainer}>
            <DownloadButtons vertical={false} trackFrom="Hero" />
          </div>
        </div>
        <div className={styles.gradientContainer}>
          <div className={styles.imageContainer}>
            <ThemedImage sources={sources} className={styles.heroImage} />
            <SecondaryButton title="Watch the Demo" onClick={handleDialogOpen} />
          </div>
          <div className={styles.gradient}></div>
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
