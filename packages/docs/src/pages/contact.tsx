import React from "react";
import Layout from "@theme/Layout";

import styles from "./contact.module.css";
import MailIcon from "../components/MailIcon";
import MessageIcon from "../components/MessageIcon";
import FlagIcon from "../components/FlagIcon";
import ArrowRightSmallIcon from "../components/ArrowRightSmallIcon";
import UserIcon from "../components/UserIcon";

export default function Contact(): JSX.Element {
  return (
    <Layout description="Contact Us – Radon IDE: VSCode Extension for React Native">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <div className={styles.wrapper}>
            <h1 className={styles.headingLabel}>Hi, how can we help you?</h1>
            <h3 className={styles.subheadingLabel}>Get in touch with our sales or support team.</h3>

            <div className={styles.row}>
              <div className={styles.card}>
                <div>
                  <h4>
                    <MailIcon color={"var(--swm-navy-light-60)"} /> Sales
                  </h4>
                  <p>Contact us about plans, pricings, and enterprise contracts.</p>
                </div>

                <div>
                  <a
                    href="mailto:projects@swmansion.com"
                    target="_top"
                    className={styles.contactButton}>
                    Talk to Sales <ArrowRightSmallIcon />
                  </a>
                </div>
              </div>

              <div className={styles.card}>
                <div>
                  <h4>
                    <MessageIcon color={"var(--swm-navy-light-60)"} /> Help & Support
                  </h4>
                  <p>
                    Get help with your subscription, ask questions, report problems, or leave
                    feedback.
                  </p>
                </div>
                <div>
                  <a href="mailto:ide@swmansion.com" target="_top" className={styles.contactButton}>
                    Contact Support <ArrowRightSmallIcon />
                  </a>
                </div>
              </div>

              <div className={styles.card}>
                <div>
                  <h4>
                    <FlagIcon color={"var(--swm-navy-light-60)"} /> Issues & Feature Requests
                  </h4>
                  <p>Found a bug or want to request a new feature?</p>
                </div>
                <div>
                  <a
                    href="https://github.com/software-mansion/radon-ide/issues/new/choose"
                    target="_blank"
                    className={styles.contactButton}>
                    Open a GitHub Issue <ArrowRightSmallIcon />
                  </a>
                </div>
              </div>

              <div className={styles.card}>
                <div>
                  <h4>
                    <UserIcon color={"var(--swm-navy-light-60)"} /> Customer Portal
                  </h4>
                  <p>Manage your subscription and access your license key.</p>
                </div>
                <div>
                  <a
                    href="https://portal.ide.swmansion.com/"
                    target="_blank"
                    className={styles.contactButton}>
                    Visit Radon IDE Portal <ArrowRightSmallIcon />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
