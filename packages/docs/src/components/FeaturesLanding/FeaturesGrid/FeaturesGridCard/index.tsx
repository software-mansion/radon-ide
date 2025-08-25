import React from "react";
import styles from "./styles.module.css";

interface FeatureGridCardProps {
  label: string;
  title: string;
  content: string;
  imageSrc: string;
}

export default function FeaturesGridCard({
  label,
  title,
  content,
  imageSrc,
}: FeatureGridCardProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <p className={styles.label}>{label}</p>
          <h1 className={styles.title}> {title}</h1>
        </div>
        <div className={styles.textContent}>{content}</div>
      </div>
      <img src={imageSrc}></img>
    </div>
  );
}
