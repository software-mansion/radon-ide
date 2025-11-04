import React from "react";
import Layout from "@theme/Layout";
import styles from "./index.module.css";
import clsx from "clsx";

const currentDocuments = [
  {
    label: "Privacy Policy",
    link: "/legal/privacy-policy",
  },
  {
    label: "Radon IDE Freeware License Terms",
    link: "/legal/free-license-terms",
  },
  {
    label: "Subscription Agreement for Radon IDE Pro",
    link: "/legal/pro-license-terms",
  },
  {
    label: "Subscription Agreement for Radon IDE Team",
    link: "/legal/team-license-terms",
  },
  {
    label: "Terms and conditions of purchase",
    link: "/legal/purchase-terms",
  },
  {
    label: "Refund policy",
    link: "/legal/refund-policy",
  },
  {
    label: "Data Processing Addendum (DPA)",
    link: "/legal/dpa",
  },
  {
    label: "Sub-Processors",
    link: "/legal/subprocessors",
  },
];

const legacyDocuments = [
  {
    label: "Subscription Agreement for Individual Customers",
    link: "/legal/personal-license-terms",
  },
  {
    label: "Subscription Agreement For Businesses and Organizations",
    link: "/legal/b2b-license-terms",
  },
  {
    label: "Free Trial License Terms",
    link: "/legal/free-trial",
  },
  {
    label: "Supporter's License Terms",
    link: "/legal/supporter-terms",
  },
  {
    label: "Early Access Terms of use",
    link: "/legal/early-terms-of-use",
  },
];

export default function Legal(): JSX.Element {
  return (
    <Layout description="An IDE for React Native">
      <div className={styles.preventfulContainer}>
        <div className={clsx(styles.wrapper, "border-layout")}>
          <div className={styles.container}>
            <h1>Software Mansion Radon IDE Terms & Policies</h1>
            {currentDocuments.map((item) => (
              <a href={item.link} className={styles.card}>
                <div>{item.label}</div> <span className={styles.button}>Read document</span>
              </a>
            ))}
            <h2>Legacy documents</h2>
            {legacyDocuments.map((item) => (
              <a href={item.link} className={styles.card}>
                <div>{item.label}</div> <span className={styles.button}>Read document</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
