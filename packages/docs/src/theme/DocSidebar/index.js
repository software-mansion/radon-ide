import React from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import DocSidebarDesktop from "@swmansion/t-rex-ui/dist/components/DocSidebar/Desktop/index.js";
import CloseIcon from "../../components/CloseIcon";
import ChevronDownIcon from "../../components/ChevronDownIcon";

export default function DocSidebarWrapper(props) {
  const heroImages = {
    logo: useBaseUrl("/img/logo.svg"),
  };

  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button
        className={`swm-doc-sidebar-toggle ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Sidebar"
      >
        {isOpen ? (
          <CloseIcon width={20} height={20} />
        ) : (
          <ChevronDownIcon
            width={20}
            height={20}
            style={{ transform: "rotate(-90deg)" }}
          />
        )}
      </button>
      <div className={`swm-doc-sidebar-container ${isOpen ? "open" : ""}`}>
        <DocSidebarDesktop heroImages={heroImages} {...props} />
      </div>
    </>
  );
}
