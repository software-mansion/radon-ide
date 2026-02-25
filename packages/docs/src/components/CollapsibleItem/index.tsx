import React from "react";
import { useCollapsible, Collapsible } from "@docusaurus/theme-common";
import styles from "./styles.module.css";
import PlusIcon from "../PlusIcon";
import MinusIcon from "../MinusIcon";

interface CollapsibleItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function CollapsibleItem({
  title,
  children,
  defaultOpen = false,
}: CollapsibleItemProps) {
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
        {title}
        {collapsed ? <PlusIcon /> : <MinusIcon />}
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
