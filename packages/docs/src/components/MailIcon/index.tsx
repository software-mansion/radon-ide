import * as React from "react";

interface MailIconProps {
  color?: string;
}

function MailIcon({ color = "#001A72", ...rest }: MailIconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      <path
        d="M3.293 5.293A.997.997 0 014 5h16c.276 0 .526.112.707.293m-17.414 0A.997.997 0 003 6v12a1 1 0 001 1h16a1 1 0 001-1V6a.997.997 0 00-.293-.707m-17.414 0l7.293 7.293a2 2 0 002.828 0l7.293-7.293"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default MailIcon;
