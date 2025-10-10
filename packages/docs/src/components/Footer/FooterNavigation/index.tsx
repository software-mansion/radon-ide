import React from "react";
import styles from "./styles.module.css";
import { useModal } from "../../ModalProvider";
import { track } from "@vercel/analytics";

interface FooterProps {
  title: string;
  links: { label: string; to?: string }[];
}

const footerLinks: FooterProps[] = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Enterprise", to: "/enterprise" },
      { label: "Pricing", to: "/pricing" },
      {
        label: "Download",
      },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Customer Portal", to: "https://portal.ide.swmansion.com/" },
      { label: "Docs", to: "/docs/category/getting-started" },
      { label: "Changelog", to: "/docs/getting-started/changelog" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/legal/privacy-policy" },
      { label: "Legal", to: "/legal" },
    ],
  },
];

export default function FooterNavigation() {
  const { onOpen } = useModal();

  const handleFooterCTAClick = () => {
    track("Footer CTA");
  };

  return (
    <>
      {footerLinks.map((section, index) => (
        <div key={index} className={styles.footerSection}>
          <p className={styles.sectionTitle}>{section.title}</p>
          <ul className={styles.sectionLinks}>
            {section.links.map((link, idx) => (
              <li key={idx}>
                {link.to ? (
                  <a href={link.to} target={link.to.startsWith("https:") ? "_blank" : "_self"}>
                    {link.label}
                  </a>
                ) : (
                  <a
                    onClick={() => {
                      onOpen();
                      handleFooterCTAClick();
                    }}>
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
