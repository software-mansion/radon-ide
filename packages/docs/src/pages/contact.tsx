import React from "react";
import Layout from "@theme/Layout";

import styles from "./contact.module.css";
import MailIcon from "../components/MailIcon";
import MessageIcon from "../components/MessageIcon";
import FlagIcon from "../components/FlagIcon";
import UserIcon from "../components/UserIcon";
import ContactCard from "../components/ContactCard";
import PageLayout from "../components/PageLayout";

export default function Contact(): JSX.Element {
  return (
    <Layout description="Contact Us – Radon IDE: VSCode Extension for React Native">
      <div className={styles.preventfulContainer}>
        <div className={styles.wrapper}>
          <div className={styles.titleContainer}>
            <h1 className={styles.headingLabel}>Contact</h1>
            <h3 className={styles.subheadingLabel}>Get in touch with our sales or support team.</h3>
          </div>
          <div className={styles.row}>
            <ContactCard
              icon={<MailIcon color={"var(--radon-icon)"} />}
              title="Sales"
              description="Contact us about plans, pricings, and enterprise contracts."
              linkText="Talk to Sales"
              linkHref="mailto:projects@swmansion.com"
            />
            <ContactCard
              icon={<MessageIcon color={"var(--radon-icon)"} />}
              title="Help & Support"
              description="Get help with your subscription, ask questions, report problems, or leave feedback."
              linkText="Contact Support"
              linkHref="mailto:ide@swmansion.com"
            />
            <ContactCard
              icon={<FlagIcon color={"var(--radon-icon)"} />}
              title="Issues & Feature Requests"
              description="Found a bug or want to request a new feature?"
              linkText="Open a GitHub Issue"
              linkHref="https://github.com/software-mansion/radon-ide/issues/new/choose"
              linkTarget="_blank"
            />
            <ContactCard
              icon={<UserIcon color={"var(--radon-icon)"} />}
              title="Customer Portal"
              description="Manage your subscription and access your license key."
              linkText="Visit Radon IDE Portal"
              linkHref="https://portal.ide.swmansion.com/"
              linkTarget="_blank"
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
