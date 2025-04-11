import React from "react";
import styles from "./styles.module.css";

export function PrivacyPolicyNote() {
  return (
    <div className={styles.privacyPolicyNote}>
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
