import "./Label.css";
import { ComponentProps } from "react";

function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={`${className} label`} {...props} />;
}

export default Label;
