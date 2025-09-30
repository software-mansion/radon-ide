// Language definitions imports
import langJson from "@shikijs/langs/json";
import langJavascript from "@shikijs/langs/javascript";
import langJsx from "@shikijs/langs/jsx";
import langTypescript from "@shikijs/langs/typescript";
import langTsx from "@shikijs/langs/tsx";
import langHtml from "@shikijs/langs/html";
import langXml from "@shikijs/langs/xml";
import langCss from "@shikijs/langs/css";
import langLess from "@shikijs/langs/less";
import langSass from "@shikijs/langs/sass";
import langScss from "@shikijs/langs/scss";
import langPython from "@shikijs/langs/python";
import langJava from "@shikijs/langs/java";
import langKotlin from "@shikijs/langs/kotlin";
import langCpp from "@shikijs/langs/cpp";
import langGo from "@shikijs/langs/go";
import langPhp from "@shikijs/langs/php";
import langShellscript from "@shikijs/langs/shellscript";
import langCoffee from "@shikijs/langs/coffee";
import langClojure from "@shikijs/langs/clojure";
import langDart from "@shikijs/langs/dart";
import langScala from "@shikijs/langs/scala";
import langAngularHtml from "@shikijs/langs/angular-html";
import langSvelte from "@shikijs/langs/svelte";
import langVue from "@shikijs/langs/vue";
import langMarkdown from "@shikijs/langs/markdown";
import langWasm from "@shikijs/langs/wasm";
import langYaml from "@shikijs/langs/yaml";

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

const JS_REGEX_ENGINE = createJavaScriptRegexEngine();
/**
 * Maximum content length (in characters) to apply syntax highlighting
 * For larger content, plain text will be displayed to avoid performance issues
 */
const MAX_HIGHLIGHT_LENGTH = 50_000;

/**
 * Array of language definitions for Shiki library.
 * Supported languages are provided explicitly and used in createHighlighterCore,
 * to avoid loading all languages and bloating the bundle. See bundle options section:
 * https://github.com/avgvstvs96/react-shiki
 */
const LANG_ARRAY = [
  langJson,
  langJavascript,
  langJsx,
  langTypescript,
  langTsx,
  langHtml,
  langXml,
  langCss,
  langLess,
  langSass,
  langScss,
  langPython,
  langJava,
  langKotlin,
  langCpp,
  langGo,
  langPhp,
  langShellscript,
  langCoffee,
  langClojure,
  langDart,
  langScala,
  langAngularHtml,
  langSvelte,
  langVue,
  langMarkdown,
  langWasm,
  langYaml,
];

/**
 * Memoized highlighter instance to ensure we only create one highlighter
 * across all component instances.
 */
let highlighterInstance: unknown | null = null;
let highlighterPromise: Promise<unknown> | null = null;

/**
 * Gets or creates a Shiki highlighter instance with memoization.
 * The highlighter is created only once and reused across all calls.
 * @returns Promise that resolves to the highlighter instance
 */
const getHighlighter = async () => {
  if (highlighterInstance) {
    return highlighterInstance;
  }
  if (highlighterPromise) {
    return highlighterPromise;
  }

  highlighterPromise = createHighlighterCore({
    langs: LANG_ARRAY,
    engine: JS_REGEX_ENGINE,
  }).then((instance) => {
    highlighterInstance = instance;
    return instance;
  });

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

  const contentLength = content?.length ?? 0;
  const shouldHighlight = contentLength <= MAX_HIGHLIGHT_LENGTH;
  const isPlainText = language === "plaintext";

  const shouldShowNoHighlightInfo = !isLoading && !isPlainText && !shouldHighlight;
  const shouldShowPlaintext = isLoading || !highlighter || !shouldHighlight;

  useEffect(() => {
    // Only initialize highlighter if content should be highlighted
    if (!shouldHighlight) {
      setIsLoading(false);
      return;
    }

    getHighlighter()
      .then((instance) => {
        setHighlighter(instance);
      })
      .catch((error) => {
        console.error("Failed to initialize highlighter:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [shouldHighlight]);

  // Show plain text while loading or if content is too large
  if (shouldShowPlaintext) {
    return (
      <>
        {shouldShowNoHighlightInfo && (
          <pre className="no-highlight-info">
            <span className="codicon codicon-info" /> Content too large for syntax highlighting.
          </pre>
        )}
        <pre className={className}>{content ?? placeholder}</pre>
      </>
    );
  }

  return (
    <ShikiHighlighter
      theme={(theme as unknown) ?? "none"}
      // @ts-expect-error - Type compatibility issue with HighlighterCore for some reason
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
