import { useState, useEffect } from "react";
import { ThemeData, ThemeType } from "../types/theme";

const THEME_TYPE_ATTRIBUTE = "data-vscode-theme-kind";
const THEME_ID_ATTRIBUTE = "data-vscode-theme-id";

export default function useThemeExtractor() {
  const [editorThemeData, setEditorThemeData] = useState<ThemeData | undefined>(undefined);

  useEffect(() => {
    const body = document.querySelector("body");
    if (!body) {
      return;
    }

    const mutationCallback = (mutations: MutationRecord[]) => {
      mutations.forEach((mut) => {
        if (
          mut.type !== "attributes" &&
          mut.attributeName !== THEME_TYPE_ATTRIBUTE &&
          mut.attributeName !== THEME_ID_ATTRIBUTE
        ) {
          return;
        }

        const newThemeData = {
          themeType: body.getAttribute(THEME_TYPE_ATTRIBUTE) as ThemeType,
          themeName: body.getAttribute(THEME_ID_ATTRIBUTE) || "",
        };

        setEditorThemeData((prev) => {
          const hasThemeChanged =
            prev?.themeName === newThemeData.themeName &&
            prev?.themeType === newThemeData.themeType;
          return hasThemeChanged ? prev : newThemeData;
        });
      });
    };

    const classObserver = new MutationObserver(mutationCallback);
    classObserver.observe(body, { attributes: true });

    const initialThemeData: ThemeData = {
      themeType: body.getAttribute(THEME_TYPE_ATTRIBUTE) as ThemeData["themeType"],
      themeName: body.getAttribute(THEME_ID_ATTRIBUTE) || "",
    };
    setEditorThemeData(initialThemeData);

    return () => classObserver.disconnect();
  }, []);

  return editorThemeData;
}
