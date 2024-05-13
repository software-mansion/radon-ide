import React from "react";

import { useThemeConfig, ErrorCauseBoundary } from "@docusaurus/theme-common";
import { splitNavbarItems, useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import NavbarItem from "@theme/NavbarItem";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import NavbarLogo from "@theme/Navbar/Logo";

import usePageType from "@site/src/hooks/usePageType";
import styles from "./styles.module.css";

function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items;
}
function NavbarItems({ items }) {
  return (
    <>
      {items.map((item, i) => (
        <ErrorCauseBoundary
          key={i}
          onError={(error) =>
            new Error(
              `A theme navbar item failed to render.
Please double-check the following navbar item (themeConfig.navbar.items) of your Docusaurus config:
${JSON.stringify(item, null, 2)}`,
              { cause: error }
            )
          }>
          <NavbarItem {...item} />
        </ErrorCauseBoundary>
      ))}
    </>
  );
}
function NavbarContentLayout({ left, right }) {
  return (
    <div className="navbar__inner">
      <div className="navbar__items">{left}</div>
      <div className="navbar__items navbar__items--right">{right}</div>
    </div>
  );
}
export default function NavbarContent() {
  const { isDocumentation } = usePageType();
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();
  const [leftItems, rightItems] = splitNavbarItems(items);

  return (
    <NavbarContentLayout
      left={
        <>
          <div className={styles.logoWrapperLanding}>
            <NavbarLogo />
          </div>
        </>
      }
      right={
        <>
          <NavbarItems items={rightItems} />
          {!mobileSidebar.disabled && isDocumentation && <NavbarMobileSidebarToggle />}
        </>
      }
    />
  );
}
