import { useColorMode, useThemeConfig } from "@docusaurus/theme-common";
import React, { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  const {
    navbar: { logo },
  } = useThemeConfig();
  const { colorMode } = useColorMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <img
      src={colorMode === "dark" ? `/${logo.srcDark}` : `/${logo.src}`}
      width={logo.width}
      height={logo.height}
      alt={logo.alt}
      className={className}
    />
  );
}
