import "./Input.css";
import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  'data-error'?: boolean;
};

/** 
    Plain `input` element to render an input field with default styling.
**/
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => {
    return (
      <input
        ref={ref}
        {...props}
      />
    );
  }
);
