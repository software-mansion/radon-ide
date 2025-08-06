import React from "react";
import styles from "./styles.module.css";
import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import clsx from "clsx";
import CloseButton from "../../CloseButton";

const navItems = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Enterprise", to: "/enterprise" },
  { label: "Docs", to: "/docs/category/getting-started" },
  { label: "Contact", to: "/contact" },
  { label: "GitHub", to: "https://github.com/software-mansion/radon-ide/" },
  {
    label: "Download",
    to: "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide",
  },
];

export default function NavbarMobileSidebar() {
  const mobileSidebar = useNavbarMobileSidebar();

  return (
    <aside
      className={clsx(styles.container, {
        [styles.open]: mobileSidebar.shown,
      })}
      aria-hidden={!mobileSidebar.shown}>
      {/* <CloseButton onClick={mobileSidebar.toggle} /> */}
      <ul className={styles.mobileNavLinks}>
        {navItems.map((item, idx) => (
          <li key={idx}>
            <a href={item.to} onClick={mobileSidebar.toggle}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
