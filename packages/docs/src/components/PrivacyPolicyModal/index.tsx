import React, { useState } from "react";
import styles from "./styles.module.css";

const WAS_EVER_CLOSED_KEY = "was-ever-closed-privacy-policy-banner-v1";

export function PrivacyPolicyNote() {
  const wasEverClosed = global.localStorage.getItem(WAS_EVER_CLOSED_KEY);
  const [isHidden, setIsHidden] = useState(Boolean(wasEverClosed));

  const handleClose = () => {
    setIsHidden(true);
    global.localStorage.setItem(WAS_EVER_CLOSED_KEY, "true");
  };

  if (isHidden) return null;

  return (
    <div className={styles.privacyPolicyNote}>
      <button onClick={handleClose} className={styles.closeButton} aria-label="Close">
        &#x2715;
      </button>
      <p>
        We are committed to protecting your privacy. This Privacy Policy outlines how we collect,
        use, and safeguard your information when you use our services.
      </p>
      <p>
        For more details, please refer to our{" "}
        <a href="/legal/privacy-policy">full Privacy Policy document</a>.
      </p>
    </div>
  );
}
