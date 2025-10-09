import React from "react";
import styles from "./styles.module.css";
import { useModal } from "../../ModalProvider";

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
      { label: "Customer Portal", to: "/customer-portal" },
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
  return (
    <>
      {footerLinks.map((section, index) => (
        <div key={index} className={styles.footerSection}>
          <p className={styles.sectionTitle}>{section.title}</p>
          <ul className={styles.sectionLinks}>
            {section.links.map((link, idx) => (
              <li key={idx}>
                {link.to ? (
                  <a href={link.to}>{link.label}</a>
                ) : (
                  <a onClick={onOpen}>{link.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
