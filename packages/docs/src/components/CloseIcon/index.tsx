import * as React from "react";
export default function CloseIcon(props) {
  // return (
  //   <svg
  //     xmlns="http://www.w3.org/2000/svg"
  //     width={16}
  //     height={16}
  //     fill="none"
  //     viewBox="0 0 24 24"
  //     {...props}>
  //     <path
  //       stroke="#001A72"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //       strokeWidth={1.5}
  //       d="m5.833 5.833 16.333 16.334m-16.333 0L22.166 5.833"
  //     />
  //   </svg>
  // );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}>
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="#FAFAFA"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
