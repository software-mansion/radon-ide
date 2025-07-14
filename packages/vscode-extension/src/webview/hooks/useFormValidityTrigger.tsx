import { useEffect, RefObject } from "react";

function useFormValidityTrigger(formRef: RefObject<HTMLFormElement | null>, callback: () => void) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    callback(); // Initial check

    // Watch for changes to the form structure (i.e. new required fields added
    // or values changed)
    const observer = new MutationObserver(callback);
    observer.observe(form, { childList: true, subtree: true, attributes: true });

    // Watch for input changes
    form.addEventListener("input", callback);

    return () => {
      observer.disconnect();
      form.removeEventListener("input", callback);
    };
  }, [callback]);
}

export default useFormValidityTrigger;
