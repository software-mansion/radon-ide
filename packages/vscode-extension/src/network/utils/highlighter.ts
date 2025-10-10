import { createHighlighterCore, createJavaScriptRegexEngine } from "react-shiki/core";

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

const JS_REGEX_ENGINE = createJavaScriptRegexEngine();

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
export async function getHighlighter() {
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
}
