interface RecordingIconProps {
  color?: string;
}

const RecordingIcon = ({ color = "currentColor", ...rest }: RecordingIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    {...rest}>
    <path
      stroke={color}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m17 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L17 10.5"
    />
    <rect
      x="3"
      y="6"
      width="14"
      height="12"
      rx="2"
      stroke={color}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default RecordingIcon;
