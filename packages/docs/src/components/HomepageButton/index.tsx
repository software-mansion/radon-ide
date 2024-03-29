import React from "react";
import styles from "./styles.module.css";

import ArrowRight from "@site/static/img/arrow-right-hero.svg";
import clsx from "clsx";

export const ButtonStyling = {
  TO_NAVY: styles.buttonTransparentStyling,
  TO_WHITE: styles.buttonWhiteStyling,
  TO_TRANSPARENT: styles.buttonGreenStyling,
};

export const BorderStyling = {
  PURPLE: styles.buttonPurpleBorderStyling,
  NAVY: styles.buttonNavyBorderStyling,
};

const HomepageButton: React.FC<{
  title: string;
  subtitle?: string;
  href: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
  backgroundStyling?: string;
  borderStyling?: string;
  enlarged?: boolean;
}> = ({
  title,
  subtitle,
  href,
  target = "_self",
  backgroundStyling = ButtonStyling.TO_TRANSPARENT,
  borderStyling = BorderStyling.PURPLE,
}) => {
  return (
    <a href={href} target={target} className={styles.homepageButtonLink}>
      <div
        className={clsx(
          styles.homepageButton,
          backgroundStyling,
          borderStyling,
          subtitle && styles.homepageButtonWithSubtitle
        )}>
        <div className={clsx(subtitle && styles.homepageButtonSubtitleWrapper)}>
          {title}
          {subtitle && <span>{subtitle}</span>}
        </div>

        <div className={styles.arrow}>
          <ArrowRight />
        </div>
      </div>
    </a>
  );
};

export default HomepageButton;
