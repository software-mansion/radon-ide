import * as React from "react";

interface MessageIconProps {
  color?: string;
}

function MessageIcon({ color = "#001A72", ...rest }: MessageIconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      <path
        d="M7 21v-5H4V4h16v12h-8l-5 5z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default MessageIcon;
