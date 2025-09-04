import React from "react";
import styles from "./styles.module.css";

interface FooterProps {
  title: string;
  links: { label: string; to: string }[];
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
        to: "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide",
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
      { label: "Privacy", to: "/privacy" },
      { label: "Legal", to: "/legal" },
    ],
  },
];

export default function FooterNavigation() {
  return (
    <>
      {footerLinks.map((section, index) => (
        <div key={index} className={styles.footerSection}>
          <p className={styles.sectionTitle}>{section.title}</p>
          <ul className={styles.sectionLinks}>
            {section.links.map((link, idx) => (
              <li key={idx}>
                <a href={link.to} className={styles.footerLink}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
