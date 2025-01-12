import "./Textarea.css";
import React from "react";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  'data-error'?: boolean;
};

/** 
    Plain `textarea` element to render a textarea field with default styling.
**/
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (props, ref) => {
    return (
      <textarea
        ref={ref}
        {...props}
      />
    );
  }
);
