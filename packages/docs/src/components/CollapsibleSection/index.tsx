import React from "react";
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

  return (
    <div className={styles.collapsible}>
      <button
        className={styles.header}
        onClick={() => {
          setCollapsed(!collapsed);
        }}
        type="button">
        <span className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ""}`}>&#9654;</span>
        {title}
      </button>
      <Collapsible
        lazy={false}
        collapsed={collapsed}
        disableSSRStyle
        onCollapseTransitionEnd={setCollapsed}>
        <div className={styles.content}>{children}</div>
      </Collapsible>
    </div>
  );
}
