import { useEffect, RefObject, useState } from "react";

function useFormValidity(formRef: RefObject<HTMLFormElement | null>) {
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    setIsValid(form.checkValidity());
    const callback = () => {
      setIsValid(form.checkValidity());
    };

    // Watch for changes to the form structure (i.e. new required fields added
    // or values changed). We use Mutation Observer which blocks layout and
    // hence we delay the actual callback to run after the next tick.
    const delayedCallback = () => setTimeout(() => setIsValid(form.checkValidity()), 0);
    const observer = new MutationObserver(delayedCallback);
    observer.observe(form, { childList: true, subtree: true, attributes: true });

    // Watch for input changes
    form.addEventListener("input", callback);

    return () => {
      observer.disconnect();
      form.removeEventListener("input", callback);
    };
  }, [formRef]);

  return isValid;
}

export default useFormValidity;
