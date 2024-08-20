import "./Label.css";
import { ComponentProps } from "react";
import classNames from "classnames";

function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={classNames("label", className)} {...props} />;
}

export default Label;
