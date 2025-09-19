import { useState, useEffect, useRef } from "react";
import { useNetwork } from "../providers/NetworkProvider";
import { ThemeObject } from "../../utilities/themeExtraction";

const THEME_TYPE_ATTRIBUTE = "data-vscode-theme-kind";
const THEME_ID_ATTRIBUTE = "data-vscode-theme-id";

export default function useThemeExtractor() {
  const { getThemeData } = useNetwork();
  const [editorThemeData, setEditorThemeData] = useState<ThemeObject | undefined>(undefined);
  const previousThemeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const body = document.querySelector("body");
    if (!body) {
      return;
    }

    const mutationCallback = (mutations: MutationRecord[]) => {
      mutations.forEach(async (mut) => {
        if (
          mut.type !== "attributes" &&
          mut.attributeName !== THEME_TYPE_ATTRIBUTE &&
          mut.attributeName !== THEME_ID_ATTRIBUTE
        ) {
          return;
        }
        
        const themeId = body.getAttribute(THEME_ID_ATTRIBUTE);
        if (!themeId || previousThemeIdRef.current === themeId) {
          return;
        }

        previousThemeIdRef.current = themeId;
        const newThemeData = await getThemeData(themeId);

        setEditorThemeData(newThemeData);
      });
    };

    const classObserver = new MutationObserver(mutationCallback);
    classObserver.observe(body, { attributes: true });

    // Initial theme data
    getThemeData().then((initialThemeData) => {
      setEditorThemeData(initialThemeData);
    });

    return () => classObserver.disconnect();
  }, [getThemeData]);

  return editorThemeData;
}
