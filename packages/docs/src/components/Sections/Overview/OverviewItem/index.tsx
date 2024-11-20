import React from "react";
import styles from "./styles.module.css";

interface Props {
  label: string;
  title: string;
  body: string;
  mediaSrc?: string;
}

const OverviewItem = ({ label, title, body, mediaSrc }: Props) => {
  return (
    <>
      <section className={styles.description}>
        <p className={styles.itemLabel}>{label}</p>
        <h2 className={styles.itemTitle}>{title}</h2>
        <p className={styles.itemBody}>{body}</p>
      </section>
      <div className={styles.media}>
        <video autoPlay loop muted playsInline>
          <source src={mediaSrc} type="video/mp4" />
        </video>
      </div>
    </>
  );
};

export default OverviewItem;
