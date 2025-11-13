import React from "react";
import styles from "./styles.module.css";
import clsx from "clsx";

interface PricingButtonProps {
  children: string;
  stylingFilled?: boolean;
  isTable?: boolean;
  target?: "_blank" | "_parent" | "_self" | "_top";
  onClick?: () => void;
}

function PricingButton({
  children,
  stylingFilled,
  isTable = false,
  target = "_blank",
  onClick,
}: PricingButtonProps) {
  return (
    <a
      target={target}
      onClick={onClick}
      className={clsx(
        stylingFilled ? styles.buttonLink : styles.buttonLinkEmpty,
        isTable ? styles.buttonTable : styles.buttonCard
      )}>
      <div className={styles.button}>{children}</div>
    </a>
  );
}

export default PricingButton;
