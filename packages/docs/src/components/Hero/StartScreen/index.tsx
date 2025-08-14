import React from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";
import SecondaryButton from "../../SecondaryButton";
import CloseIcon from "../../CloseIcon";
import DownloadButtons from "@site/src/components/DownloadButtons";

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
          <p className={styles.preheadingLabel}>
            <span className={styles.left}>Trusted by</span>
            <span className={styles.center}>24,000+ engineers</span> worldwide
          </p>
          <h1 className={styles.headingLabel}>
            The Best <span className={styles.headingIde}>IDE</span> <br /> for&nbsp;
            <span className={styles.headingRN}>React Native</span> & Expo
          </h1>
          <h2 className={styles.subheadingLabel}>
            Radon IDE extension turns your VSCode or Cursor editor <br /> into fully-featured IDE
            for faster and more efficient development<span className={styles.dot}>.</span>{" "}
            <p>
              Trusted by <span>24,000+ engineers worldwide</span>.
            </p>
          </h2>
          <div className={styles.buttonContainer}>
            <DownloadButtons vertical={false} />
          </div>
          <div className={styles.headingDisclaimer}>
            Try 30 days for free. No sign up or credit card required.
          </div>
        </div>
        <div className={styles.gradientContainer}>
          <div className={styles.imageContainer}>
            <img src="../img/screenshot_hero.png" className={styles.heroImage} />
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
