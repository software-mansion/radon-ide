import React from "react";
import styles from "./styles.module.css";
import { useThemeConfig } from "@docusaurus/theme-common";
import Logo from "../../Logo";
import clsx from "clsx";

interface FooterContentProps {
  title: string;
  links: { label: string; to: string }[];
}

const footerLinks: FooterContentProps[] = [
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
      { label: "Changelog", to: "/changelog" },
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

const footerNavigation = () => {
  return footerLinks.map((section, index) => (
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
  ));
};

export default function FooterContent() {
  const {
    footer: { copyright },
  } = useThemeConfig();
  return (
    <div className={clsx(styles.container, "border-layout")}>
      <div className={styles.left}>
        <div className={styles.brandContainer}>
          <Logo className={styles.logo} />
          <div className={styles.brandInfo}>
            <div className={styles.brand}>
              © 2025 <a href="https://swmansion.com/">Software Mansion</a>
            </div>
            <p className={styles.copyright}>{copyright}</p>
          </div>
        </div>
        <div className={styles.socialMedia}>
          <a href="https://www.youtube.com/@SoftwareMansion" className={styles.youtubeIcon}></a>
          <a href="https://x.com/swmansion" className={styles.xIcon}></a>
          <a
            href="https://github.com/software-mansion/radon-ide/"
            className={styles.githubIcon}></a>
        </div>
      </div>
      <div className={styles.right}>{footerNavigation()}</div>
    </div>
  );
}
