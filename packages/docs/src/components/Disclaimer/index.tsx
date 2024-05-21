import React from "react";
import styles from "./styles.module.css";

const Disclaimer = () => {
  return (
    <div className={styles.disclaimerContainer}>
      {/* <h2 className={styles.disclaimerHeading}>Note</h2> */}
      <p>
        <strong>Note: </strong>React Native IDE is not a ready product (yet). Currently it's in beta
        stage and only supports development on macOS in VSCode and Cursor. We are hoping that
        together with the community we will be able to get there soon.
      </p>
    </div>
  );
};

export default Disclaimer;
