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
    const body = document.querySelector("body");
    if (!body) {
      return;
    }

    const mutationCallback = (mutations: MutationRecord[]) => {
      mutations.forEach(async (mut) => {
        if (
          mut.type !== "attributes" &&
          mut.attributeName !== THEME_VARIANT_ATTRIBUTE &&
          mut.attributeName !== THEME_ID_ATTRIBUTE
        ) {
          return;
        }

        const themeVariant = body.getAttribute(THEME_VARIANT_ATTRIBUTE) as ThemeVariant;
        const themeId = body.getAttribute(THEME_ID_ATTRIBUTE);

        if (!themeId || previousThemeIdRef.current === themeId) {
          return;
        }

        const themeDescriptor: ThemeDescriptor = { themeVariant, themeId };

        previousThemeIdRef.current = themeId;
        const newThemeData = await getThemeData(themeDescriptor);

        setEditorThemeData(newThemeData);
      });
    };

    const classObserver = new MutationObserver(mutationCallback);
    classObserver.observe(body, { attributes: true });

    const themeVariant = body.getAttribute(THEME_VARIANT_ATTRIBUTE) as ThemeVariant;
    const themeDescriptor: ThemeDescriptor = { themeVariant };

    // Initial theme data
    getThemeData(themeDescriptor).then((initialThemeData) => {
      setEditorThemeData(initialThemeData);
    });

    return () => classObserver.disconnect();
  }, [getThemeData]);

  return editorThemeData;
}
