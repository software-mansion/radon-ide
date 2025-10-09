import * as React from "react";

function FillPattern(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="21" fill="none" {...props}>
      <defs>
        <pattern
          id="diagonal-lines"
          patternUnits="userSpaceOnUse"
          width="8"
          height="20"
          patternTransform="rotate(30)">
          <line x1="0" y1="0" x2="0" y2="20" stroke="var( --radon-fill-pattern)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="20" fill="url(#diagonal-lines)" />
    </svg>
  );
}

export default FillPattern;
