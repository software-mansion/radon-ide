import { ReactNode, useEffect, useRef, useState } from "react";
import "./ButtonGroupLeft.css";

const SHOW_ZOOM_CONTROLS_DELAY_MS = 100;
const HIDE_ZOOM_CONTROLS_DELAY_MS = 200;

type ButtonGroupLeftProps = {
  children: ReactNode;
};

function ButtonGroupLeft({ children }: ButtonGroupLeftProps) {
  const [isMouseOver, setIsMouseOver] = useState(false);

  const showButtonGroupTimeout = useRef<NodeJS.Timeout | undefined>();
  const hideButtonGroupTimeout = useRef<NodeJS.Timeout | undefined>();

  const onMouseEnter = () => {
    console.log("FRYTKI onMouseEnter");
    clearTimeout(hideButtonGroupTimeout.current);
    showButtonGroupTimeout.current = setTimeout(() => {
      setIsMouseOver(true);
    }, SHOW_ZOOM_CONTROLS_DELAY_MS);
  };

  const onMouseLeave = () => {
    console.log("FRYTKI onMouseLeave");
    clearTimeout(showButtonGroupTimeout.current);
    hideButtonGroupTimeout.current = setTimeout(() => {
      setIsMouseOver(false);
    }, HIDE_ZOOM_CONTROLS_DELAY_MS);
  };

  useEffect(() => {
    const logFocus = (event: any) => {
      //   let element = document.activeElement!;
      //   console.log(
      //     "frytki Currently focused item:",
      //     element.tagName +
      //       (element.id ? `#${element.id}` : "") +
      //       (element.className ? `.${element.className}` : "")
      //   );
    };

    document.addEventListener("focusin", logFocus);
    document.addEventListener("focusout", logFocus);
    return () => {
      document.removeEventListener("focusin", logFocus);
      document.removeEventListener("focusout", logFocus);
    };
  }, []);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="button-group-left-wrapper">
      <div className="button-group-left-container">
        <div
          style={isMouseOver ? { transform: "translateX(0px)" } : {}}
          className="button-group-left">
          {children}
        </div>
      </div>
    </div>
  );
}

export default ButtonGroupLeft;
