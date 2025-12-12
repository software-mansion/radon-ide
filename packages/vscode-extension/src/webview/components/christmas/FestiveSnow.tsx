import { useState, useEffect } from "react";
import Snowfall from "react-snowfall";
import { use$ } from "@legendapp/state/react";
import { useStore } from "../../providers/storeProvider";

const SNOW_DARK_THEME = "#ffffff99";
const SNOW_LIGHT_THEME = "#97979787";

function FestiveSnow() {
  const store$ = useStore();
  const christmasMode = use$(store$.christmasMode);
  const [snowColor, setSnowColor] = useState(SNOW_DARK_THEME);

  useEffect(() => {
    const updateSnowColor = () => {
      const bodyClasses = document.body.classList;
      const isLightTheme = Array.from(bodyClasses).some((className) =>
        className.toLowerCase().includes("light")
      );
      setSnowColor(isLightTheme ? SNOW_LIGHT_THEME : SNOW_DARK_THEME);
    };

    updateSnowColor();

    const observer = new MutationObserver(updateSnowColor);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  if (!christmasMode) {
    return null;
  }

  return (
    // @ts-ignore
    <Snowfall speed={[0.1, 2]} color={snowColor} radius={[0.5, 2.5]} wind={[-0.5, 1.0]} />
  );
}

export default FestiveSnow;
