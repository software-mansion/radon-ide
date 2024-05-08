import React from "react";
import clsx from "clsx";

import styles from "./styles.module.css";
import usePageType from "@site/src/hooks/usePageType";

export default function FooterLayout({ style, links, logo, copyright }) {
  const { isDocumentation } = usePageType();

  return (
    <footer
      className={clsx("footer", {
        "footer--dark": style === "dark",
      })}>
      {!!isDocumentation && <div className={styles.footerBackground} />}
      <div className="container container-fluid">
        {links}
        {(logo || copyright) && (
          <div className="footer__bottom text--center">
            {logo && <div className="margin-bottom--sm">{logo}</div>}
            {copyright}
          </div>
        )}
      </div>
    </footer>
  );
}
