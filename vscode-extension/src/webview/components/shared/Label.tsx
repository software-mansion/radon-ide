import "./Label.css";

interface LabelProps {
  children: string;
}

function Label({ children }: LabelProps) {
  return <p className="label">{children}</p>;
}

export default Label;
