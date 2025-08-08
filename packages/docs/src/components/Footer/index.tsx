import React from "react";
import styles from "./styles.module.css";
import { useThemeConfig, useColorMode } from "@docusaurus/theme-common";
import FooterLayout from "./FooterLayout";
import FooterContent from "./FooterContent";

export default function Footer() {
  return (
    <FooterLayout>
      <FooterContent />
    </FooterLayout>
  );
}
