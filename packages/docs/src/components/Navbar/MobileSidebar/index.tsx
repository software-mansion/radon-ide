import React, { useState } from "react";
import styles from "./styles.module.css";
import { useNavbarMobileSidebar, useLockBodyScroll } from "@docusaurus/theme-common/internal";
import clsx from "clsx";
import { NavbarItem } from "../NavbarContent";
import NavbarDownloadButton from "../NavbarDownloadButton";
import { useAllDocsData, useDocById } from "@docusaurus/plugin-content-docs/client";

interface NavbarMobileSidebarProps {
  navbarItems: NavbarItem[];
  onOpen: () => void;
}

const DEFAULT_DOC_SUBITEMS = [
  { label: "Intro", to: "/docs/intro" },
  { label: "Getting started", to: "/docs/category/getting-started" },
  { label: "Features", to: "/docs/category/features" },
  { label: "Guides", to: "/docs/category/guides" },
  { label: "Changelog", to: "/docs/getting-started/changelog" },
];

export default function NavbarMobileSidebar({ navbarItems, onOpen }: NavbarMobileSidebarProps) {
  const mobileSidebar = useNavbarMobileSidebar();
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const allDocsData = useAllDocsData();

  const docsSubItems = React.useMemo(() => {
    try {
      const defaultPluginData = allDocsData["default"];
      const version = defaultPluginData.versions?.[0];

      // Group docs by category
      const categories = {
        "getting-started": { label: "Getting started", docs: [] as any[] },
        "features": { label: "Features", docs: [] as any[] },
        "guides": { label: "Guides", docs: [] as any[] },
      };

      // Organize docs by category
      version.docs.forEach((doc: any) => {
        const match = doc.id.match(/^(getting-started|features|guides)\/(.+)$/);
        if (match) {
          const [_, category, pageName] = match;
          if (categories[category]) {
            const label = pageName
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            categories[category].docs.push({
              label,
              to: doc.path,
            });
          }
        }
      });

      const items: any[] = [{ label: "Intro", to: "/docs/intro" }];
      Object.values(categories).forEach((category) => {
        if (category.docs.length > 0) {
          items.push({
            label: category.label,
            to: `/docs/category/${category.label.toLowerCase().replace(/\s+/g, "-")}`,
            isCategory: true,
          });
          items.push(...category.docs.map((doc) => ({ ...doc, isSubItem: true })));
        }
      });

      return items;
    } catch (error) {
      return DEFAULT_DOC_SUBITEMS;
    }
  }, [allDocsData]);

  useLockBodyScroll(mobileSidebar.shown);
  if (!mobileSidebar.shouldRender) {
    return null;
  }

  return (
    <aside
      className={clsx(styles.container, {
        [styles.open]: mobileSidebar.shown,
      })}
      aria-hidden={!mobileSidebar.shown}>
      <ul className={styles.mobileNavLinks}>
        {navbarItems.map((item, idx) => {
          const isDocs = item.label === "Docs";

          if (isDocs) {
            return (
              <li key={idx} className={styles.docsItem}>
                <button
                  className={styles.docsButton}
                  onClick={() => setIsDocsOpen(!isDocsOpen)}
                  aria-expanded={isDocsOpen}>
                  {item.label}
                </button>
                {isDocsOpen && (
                  <ul className={styles.docsSubmenu}>
                    {docsSubItems.map((subItem, subIdx) => (
                      <li key={subIdx} className={subItem.isSubItem ? styles.subItem : ""}>
                        <a
                          href={subItem.to}
                          onClick={mobileSidebar.toggle}
                          className={subItem.isCategory ? styles.categoryHeader : ""}>
                          {subItem.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          }

          return (
            <li key={idx}>
              <a href={item.to} onClick={mobileSidebar.toggle}>
                {item.label}
              </a>
            </li>
          );
        })}
        <li>
          <NavbarDownloadButton isMobile={true} onOpen={onOpen} />
        </li>
      </ul>
    </aside>
  );
}
