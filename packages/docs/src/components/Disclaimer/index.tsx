import React from "react";
import styles from "./styles.module.css";

const Disclaimer = () => {
  return (
    <div className={styles.disclaimerContainer}>
      <p>
        <strong>Note: </strong>Radon IDE is not a ready product (yet). Currently it's in beta stage
        and works with VSCode and Cursor on macOS and Windows. We are hoping that together with the
        community we will be able to get there soon.
      </p>
    </div>
  );
};

export default Disclaimer;
