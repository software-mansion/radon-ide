import React from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";
import LinkButton from "@site/src/components/LinkButton";
import { InView } from "react-intersection-observer";

interface Props {
  label: string;
  title: string;
  body: string;
  mediaSrc?: string;
  placeholderSrc?: string;
  placeholderAlt?: string;
}

const OverviewItem = ({ label, title, body, mediaSrc, placeholderSrc, placeholderAlt }: Props) => {
  const handleButtonClick = () => {
    track("Overview CTA", { section: label });
  };
  return (
    <>
      <section className={styles.description}>
        <p className={styles.itemLabel}>{label}</p>
        <h3 className={styles.itemTitle}>{title}</h3>
        <p className={styles.itemBody}>{body}</p>
        <LinkButton
          title="Get started for free"
          href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
          onClick={handleButtonClick}
        />
      </section>
      <InView triggerOnce>
        {({ inView, ref }) => (
          <div className={styles.media} ref={ref}>
            {inView ? (
              <video autoPlay loop muted playsInline poster={placeholderSrc}>
                <source src={mediaSrc} type="video/mp4" />
              </video>
            ) : (
              <img src={placeholderSrc} alt={placeholderAlt ?? title} fetchPriority="high" />
            )}
          </div>
        )}
      </InView>
    </>
  );
};

export default OverviewItem;
