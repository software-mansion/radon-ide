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
          <p className={styles.title}> {title}</p>
        </div>
        <p className={styles.textContent}>{content}</p>
      </div>
      <img className={styles.gridSvg} src={imageSrc}></img>
    </div>
  );
}
