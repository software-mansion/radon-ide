import React from "react";
import Layout from "@theme/Layout";
import styles from "./dpa.module.css";
import Button from "@site/src/components/Button";

const dpaUrl =
  "https://uzpiutmionwuvyybiztr.supabase.co/storage/v1/object/public/legal//Radon%20DPA.pdf";

export default function DPA(): JSX.Element {
  return (
    <Layout description="Data Processing Addendum">
      <div className={styles.container}>
        <h1>DPA</h1>
        <p>
          We prioritize the privacy and security of your information. To reflect this, we have
          created a Data Processing Addendum ("DPA") readily available.
        </p>
        <p>
          You can download the latest version of our DPA here. To complete the process, please sign
          the document and email it to{" "}
          <a href="mailto:legal@swmansion.com" className={styles.link}>
            legal@swmansion.com
          </a>
          .
        </p>
        <div className={styles.buttonWrapper}>
          <Button href={dpaUrl} target="_blank">
            Download DPA
          </Button>
        </div>
      </div>
    </Layout>
  );
}
