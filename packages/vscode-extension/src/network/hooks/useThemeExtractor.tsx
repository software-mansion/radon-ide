import { useState, useEffect, useRef } from "react";
import { useNetwork } from "../providers/NetworkProvider";
import { ThemeData, ThemeDescriptor, ThemeVariant } from "../../utilities/themeExtraction";

const THEME_VARIANT_ATTRIBUTE = "data-vscode-theme-kind";
const THEME_ID_ATTRIBUTE = "data-vscode-theme-id";

export default function useThemeExtractor() {
  const { getThemeData } = useNetwork();
  const [editorThemeData, setEditorThemeData] = useState<ThemeData | undefined>(undefined);
  const previousThemeIdRef = useRef<string | null>(null);

  useEffect(() => {
    /**
     * In the webview, body element holds the theme attributes defined by VS Code
     * We are able to observe changes made to those attributes to detect theme changes
     */
    const body = document.querySelector("body");
    if (!body) {
      return;
    }

    const handleThemeChange = async (mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        if (
          mutation.type !== "attributes" ||
          (mutation.attributeName !== THEME_VARIANT_ATTRIBUTE &&
            mutation.attributeName !== THEME_ID_ATTRIBUTE)
        ) {
          continue;
        }

        const themeVariant = body.getAttribute(THEME_VARIANT_ATTRIBUTE) as ThemeVariant;
        const themeId = body.getAttribute(THEME_ID_ATTRIBUTE);

        if (!themeId || previousThemeIdRef.current === themeId) {
          continue;
        }

        const themeDescriptor: ThemeDescriptor = { themeVariant, themeId };
        previousThemeIdRef.current = themeId;

        const newThemeData = await getThemeData(themeDescriptor);
        setEditorThemeData(newThemeData);
      }
    };

    const observer = new MutationObserver(handleThemeChange);
    observer.observe(body, { attributes: true });

    // Load initial theme data
    const initialThemeVariant = body.getAttribute(THEME_VARIANT_ATTRIBUTE) as ThemeVariant;
    const initialThemeDescriptor: ThemeDescriptor = { themeVariant: initialThemeVariant };

    getThemeData(initialThemeDescriptor).then((initialThemeData) => {
      setEditorThemeData(initialThemeData);
    });

    return () => observer.disconnect();
  }, [getThemeData]);

  return editorThemeData;
}
