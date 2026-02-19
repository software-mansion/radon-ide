import React, { useState } from "react";
import { useCollapsible, Collapsible } from "@docusaurus/theme-common";
import styles from "./styles.module.css";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const { collapsed, setCollapsed } = useCollapsible({
    initialState: !defaultOpen,
  });
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.collapsible}>
      <button
        className={styles.header}
        onClick={() => {
          if (collapsed) {
            setCollapsed(false);
            setOpen(true);
          } else {
            setCollapsed(true);
          }
        }}
        type="button">
        <span className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ""}`}>&#9654;</span>
        {title}
      </button>
      <Collapsible
        lazy={false}
        collapsed={collapsed}
        disableSSRStyle
        onCollapseTransitionEnd={(newCollapsed) => {
          setCollapsed(newCollapsed);
          setOpen(!newCollapsed);
        }}>
        <div className={styles.content}>{children}</div>
      </Collapsible>
    </div>
  );
}
