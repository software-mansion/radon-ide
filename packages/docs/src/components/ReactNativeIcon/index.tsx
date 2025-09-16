import * as React from "react";

interface ReactNativeIconProps {
  strokeWidth?: string;
  height: string;
  width: string;
}

function ReactNativeIcon({ strokeWidth = "2", height, width, ...props }: ReactNativeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 112 102"
      fill="none"
      {...props}>
      <path
        d="M56 61.832C61.891 61.832 66.667 57.056 66.667 51.165C66.667 45.274 61.89 40.498 56 40.498C50.11 40.498 45.334 45.274 45.334 51.165C45.334 57.056 50.108 61.832 56 61.832Z"
        fill="currentColor"
      />
      <path
        d="M56 75.165C85.455 75.165 109.333 64.42 109.333 51.165C109.333 37.91 85.455 27.165 56 27.165C26.545 27.165 2.66602 37.91 2.66602 51.165C2.66602 64.42 26.545 75.165 56 75.165Z"
        stroke="currentColor"
        stroke-width={strokeWidth}
      />
      <path
        d="M35.2149 63.165C49.9429 88.674 71.1869 103.98 82.6659 97.353C94.1459 90.725 91.5119 64.673 76.7839 39.165C62.0569 13.655 40.8119 -1.65098 29.3339 4.97702C17.8539 11.604 20.4879 37.656 35.2149 63.165Z"
        stroke="currentColor"
        stroke-width={strokeWidth}
      />
      <path
        d="M35.2147 39.165C20.4877 64.674 17.8547 90.725 29.3327 97.353C40.8127 103.98 62.0567 88.673 76.7837 63.165C91.5117 37.655 94.1457 11.605 82.6667 4.97696C71.1867 -1.65104 49.9427 13.656 35.2147 39.165Z"
        stroke="currentColor"
        stroke-width={strokeWidth}
      />
    </svg>
  );
}

export default ReactNativeIcon;
