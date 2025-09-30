import { useEffect, useState } from "react";
import {
  ShikiHighlighter,
  createHighlighterCore,
  createJavaScriptRegexEngine,
} from "react-shiki/core";
import { ThemeData } from "../../../common/theme";
import "./PayloadAndResponseTab.css";

interface HighlightedCodeBlockProps {
  content: string | null | undefined;
  language?: string;
  theme?: ThemeData;
  placeholder?: string;
  className?: string;
}

let highlighterPromise: Promise<unknown> | null = null;

const JS_REGEX_ENGINE = createJavaScriptRegexEngine();

/**
 * Array of promises with language definitions, for dynamic loading by Shiki library.
 * Supported languagues are provided explicity and used in createHighlighterCore, 
 * to avoid loading all languages and bloating the bundle. See bundle options section:
 * https://github.com/avgvstvs96/react-shiki
 */
const LANG_ARRAY = [
  import("@shikijs/langs/json"),
  import("@shikijs/langs/javascript"),
  import("@shikijs/langs/jsx"),
  import("@shikijs/langs/typescript"),
  import("@shikijs/langs/tsx"),
  import("@shikijs/langs/html"),
  import("@shikijs/langs/xml"),
  import("@shikijs/langs/css"),
  import("@shikijs/langs/less"),
  import("@shikijs/langs/sass"),
  import("@shikijs/langs/scss"),
  import("@shikijs/langs/python"),
  import("@shikijs/langs/java"),
  import("@shikijs/langs/kotlin"),
  import("@shikijs/langs/cpp"),
  import("@shikijs/langs/go"),
  import("@shikijs/langs/php"),
  import("@shikijs/langs/shellscript"),
  import("@shikijs/langs/coffee"),
  import("@shikijs/langs/clojure"),
  import("@shikijs/langs/dart"),
  import("@shikijs/langs/scala"),
  import("@shikijs/langs/angular-html"),
  import("@shikijs/langs/svelte"),
  import("@shikijs/langs/vue"),
  import("@shikijs/langs/markdown"),
  import("@shikijs/langs/wasm"),
  import("@shikijs/langs/yaml"),
];

const getHighlighter = async () => {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      return createHighlighterCore({
        langs: LANG_ARRAY,
        engine: JS_REGEX_ENGINE,
      });
    })();
  }
  return highlighterPromise;
};

const HighlightedCodeBlock = ({
  content,
  language = "plaintext",
  theme,
  placeholder = "No content",
  className = "response-tab-pre",
}: HighlightedCodeBlockProps) => {
  const [highlighter, setHighlighter] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeHighlighter = async () => {
      try {
        const highlighterInstance = await getHighlighter();
        setHighlighter(highlighterInstance);
      } catch (error) {
        console.error("Failed to initialize highlighter:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeHighlighter();
  }, []);

  if (isLoading || !highlighter) {
    return <pre className={className}>{content ?? placeholder}</pre>;
  }

  return (
    <ShikiHighlighter
      theme={(theme as unknown) ?? "none"}
      // @ts-expect-error - Type compatibility issue with HighlighterCore
      highlighter={highlighter}
      language={language}
      showLanguage={false}
      addDefaultStyles={false}
      className={className}>
      {content ?? placeholder}
    </ShikiHighlighter>
  );
};

export default HighlightedCodeBlock;
