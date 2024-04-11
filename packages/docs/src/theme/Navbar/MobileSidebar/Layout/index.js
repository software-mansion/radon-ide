import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import usePageType from "@site/src/hooks/usePageType";
import { useAllDocsData } from "@docusaurus/plugin-content-docs/client";
import { useLocation } from "@docusaurus/router";

function isActive(path, locationPathname) {
  return locationPathname.startsWith(path);
}

export default function NavbarMobileSidebarLayout({ header, secondaryMenu }) {
  const { isLanding } = usePageType();

  const data = useAllDocsData();
  const { versions } = data.default;
  const reversed = [...versions].reverse();

  const location = useLocation();
  const activeVersion = reversed.find((version) => isActive(version.path, location.pathname));

  return (
    <div className="navbar-sidebar">
      {header}
      <div className={clsx("navbar-sidebar__items")}>
        <div className="navbar-sidebar__item menu">{secondaryMenu}</div>
      </div>
    </div>
  );
}
