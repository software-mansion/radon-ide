interface DoctorIconProps {
  color?: string;
}

const DoctorIcon = ({ color = "#fff", ...rest }: DoctorIconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...rest}>
    <path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m7.793 2 .874 1.333c-.275 1.964-1.268 4.438-2.88 5.228-.143.07-.299.106-.454.106M2.873 2 2 3.333c.275 1.964 1.267 4.438 2.879 5.228.144.07.299.106.454.106m7.334 2.666a1.333 1.333 0 1 1 0 2.667 1.333 1.333 0 0 1 0-2.667Zm0 0v-1a1.667 1.667 0 0 0-3.334 0v1a2 2 0 1 1-4 0V8.667"
    />
  </svg>
);
export default DoctorIcon;
