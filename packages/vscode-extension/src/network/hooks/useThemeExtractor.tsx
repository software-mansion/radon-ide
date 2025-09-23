import { useState, useEffect, useRef } from "react";
import { useNetwork } from "../providers/NetworkProvider";
import { isThemeVariant, ThemeData, ThemeDescriptor } from "../../common/theme";
import { THEME_VARIANT_FALLBACK } from "../../common/theme";

const THEME_VARIANT_ATTRIBUTE = "data-vscode-theme-kind";
const THEME_ID_ATTRIBUTE = "data-vscode-theme-id";

export default function useThemeExtractor() {
  const { getThemeData } = useNetwork();
  const [editorThemeData, setEditorThemeData] = useState<ThemeData | undefined>(undefined);
  const previousThemeIdRef = useRef<string | undefined>(undefined);

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

        const variantAttributeValue = body.getAttribute(THEME_VARIANT_ATTRIBUTE);

        const themeVariant = isThemeVariant(variantAttributeValue)
          ? variantAttributeValue
          : THEME_VARIANT_FALLBACK;
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
    const initialVariantAttributeValue = body.getAttribute(THEME_VARIANT_ATTRIBUTE);
    const initialThemeVariant = isThemeVariant(initialVariantAttributeValue)
      ? initialVariantAttributeValue
      : THEME_VARIANT_FALLBACK;

    const initialThemeId = body.getAttribute(THEME_ID_ATTRIBUTE) || undefined;
    previousThemeIdRef.current = initialThemeId;

    const initialThemeDescriptor: ThemeDescriptor = {
      themeVariant: initialThemeVariant,
      themeId: initialThemeId,
    };

    getThemeData(initialThemeDescriptor).then((initialThemeData) => {
      setEditorThemeData(initialThemeData);
    });

    return () => observer.disconnect();
  }, [getThemeData]);

  return editorThemeData;
}
