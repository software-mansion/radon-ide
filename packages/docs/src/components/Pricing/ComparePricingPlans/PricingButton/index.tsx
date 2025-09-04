import React from "react";
import styles from "./styles.module.css";
import clsx from "clsx";

interface PricingButtonProps {
  children: string;
  stylingFilled?: boolean;
  href?: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
  onClick?: () => void;
}

function PricingButton({
  children,
  href,
  target = "_self",
  onClick,
  stylingFilled,
}: PricingButtonProps) {
  return (
    <a
      href={href}
      target={target}
      onClick={onClick}
      className={clsx(stylingFilled ? styles.buttonLink : styles.buttonLinkEmpty)}>
      <div className={styles.button}>{children}</div>
    </a>
  );
}

export default PricingButton;
