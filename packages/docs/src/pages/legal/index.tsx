import React from "react";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

const data = [
  {
    label: "Privacy Policy",
    link: "/legal/privacy-policy",
  },
  {
    label: "Subscription Agreement for Individual Customers",
    link: "/legal/personal-license-terms",
  },
  {
    label: "Subscription Agreement For Businesses and Organizations",
    link: "/legal/b2b-license-terms",
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
    label: "Free Trial License Terms",
    link: "/legal/free-trial",
  },
  {
    label: "Early Access Terms of use",
    link: "/legal/early-terms-of-use",
  },
  {
    label: "Supporter's License Terms",
    link: "/legal/supporter-terms",
  },
];

export default function Legal(): JSX.Element {
  return (
    <Layout description="An IDE for React Native">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <h1>Software Mansion Radon IDE Terms & Policies</h1>
          {data.map((item) => (
            <a href={item.link} className={styles.card}>
              <div>{item.label}</div> <span className={styles.button}>Read document</span>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}
