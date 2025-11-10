import React from "react";

export const useScrollToForm = () => {
  const scrollToForm = <T extends HTMLElement>(ref: React.RefObject<T>) => {
    ref.current?.scrollIntoView({
      behavior: "smooth",
    });
  };
  return { scrollToForm };
};
