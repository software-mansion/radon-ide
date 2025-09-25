import React from "react";
import styles from "./styles.module.css";
import RadonIcon from "../../RadonIcon";
import ReactNativeIcon from "../../ReactNativeIcon";
import EyeIcon from "../../EyeIcon";

export default function AI() {
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <span>Ai</span>
        <div className={styles.textContent}>
          <div className={styles.heading}>
            <p>Your expert React Native</p>
            <p>AI assistant inside Radon IDE</p>
          </div>
          <p className={styles.subheading}>
            Enhance your favorite LLM with up-to-date knowledge about the React Native ecosystem.
          </p>
        </div>
      </div>
      <div className={styles.radonBackgroundImage}>
        <RadonIcon />
      </div>
      <div className={styles.right}>
        <div className={styles.content}>
          <p>/help What can you do?</p>
          <div className={styles.chat}>
            <div className={styles.message}>
              <div className={styles.messageHeading}>
                <div className={styles.icon}>
                  <ReactNativeIcon strokeWidth="5" height="12" width="13" />
                </div>
                <p>Message.jsx</p>
              </div>
              <p className={styles.current}>Current file</p>
              <EyeIcon />
            </div>
            <p className={styles.question}>
              <span>@radon</span>
              How to run LLMs locally?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
