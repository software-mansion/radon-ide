import React from "react";
import Layout from "@theme/Layout";

import styles from "./contact.module.css";

export default function Contact(): JSX.Element {
  return (
    <Layout description="Contact Us – Radon IDE: VSCode Extension for React Native">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <div className={styles.container}>
            <h1 className={styles.headingLabel}>Hi, how can we help you?</h1>
            <h3 className={styles.subheadlingLabel}>
              Get in touch with our sales or support team.
            </h3>

            <div>
              <h4>Sales</h4>
              <p>Contact us about plans, pricings, and enterprise contracts.</p>
              <p>
                <a href="mailto:projects@swmansion.com">projects@swmansion.com</a>
              </p>
            </div>

            <div>
              <h4>Help & Support</h4>
              <p>Contact us about plans, pricings, and enterprise contracts.</p>
              <p>
                <a href="mailto:ide@swmansion.com">ide@swmansion.com</a>
              </p>
            </div>

            <div>
              <h4>Issues & Feature Requests</h4>
              <p>
                Found a bug or want to request a new feature? We'd love to hear about it through our
                GitHub repository.
              </p>
              <p>
                <a
                  href="https://github.com/software-mansion/radon-ide/issues/new/choose"
                  target="_blank">
                  ide@swmansion.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
