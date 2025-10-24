import { useThemeConfig } from "@docusaurus/theme-common";
import React from "react";
import ThemedImage from "@theme/ThemedImage";
import useBaseUrl from "@docusaurus/useBaseUrl";

interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  const {
    navbar: { logo },
  } = useThemeConfig();

  const sources = {
    light: useBaseUrl(logo.src),
    dark: useBaseUrl(logo.srcDark || logo.src),
  };

  return (
    <ThemedImage
      sources={sources}
      width={logo.width}
      height={logo.height}
      alt={logo.alt}
      className={className}
    />
  );
}
