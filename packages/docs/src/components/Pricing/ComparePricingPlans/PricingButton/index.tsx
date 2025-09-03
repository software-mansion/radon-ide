import React from "react";
import styles from "./styles.module.css";
import clsx from "clsx";

interface PricingButtonProps {
  stylingFilled?: boolean;
  children: string;
}

function PricingButton({ stylingFilled, children }: PricingButtonProps) {
  return (
    <a
      href="#"
      target="_self"
      className={clsx(stylingFilled ? styles.buttonLink : styles.buttonLinkEmpty)}>
      <div className={styles.button}>{children}</div>
    </a>
  );
}

export default PricingButton;
