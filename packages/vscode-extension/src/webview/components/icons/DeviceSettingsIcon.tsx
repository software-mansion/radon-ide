interface DeviceSettingsIconProps {
  color?: string;
}

function DeviceSettingsIcon({ color = "#fff", ...rest }: DeviceSettingsIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...rest}>
      <path
        fill={color}
        fillRule="evenodd"
        d="M4 1.5h8a2.5 2.5 0 0 1 0 5H4a2.5 2.5 0 0 1 0-5ZM1 4a3 3 0 0 1 3-3h8a3 3 0 1 1 0 6H4a3 3 0 0 1-3-3Zm3 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 8a3 3 0 0 0 0 6h8a3 3 0 1 0 0-6H4Zm8 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default DeviceSettingsIcon;
