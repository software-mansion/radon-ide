import { useEffect, useState } from "react";

import { ThemeData } from "../../../common/theme";
import { useHighlighter } from "../../providers/HighlighterProvider";
import "./PayloadAndResponseTab.css";

interface HighlightedCodeBlockProps {
  content: string | null | undefined;
  language?: string;
  theme?: ThemeData;
  placeholder?: string;
  className?: string;
}

/**
 * Maximum content length (in characters) to apply syntax highlighting
 * For larger content, plain text will be displayed to avoid performance issues
 */
const MAX_HIGHLIGHT_LENGTH = 100_000;

const HighlightedCodeBlock = ({
  content,
  language = "plaintext",
  theme,
  placeholder = "No content",
  className = "response-tab-pre",
}: HighlightedCodeBlockProps) => {
  const highlighter = useHighlighter();
  const [html, setHtml] = useState<string>("");

  const contentLength = content?.length ?? 0;
  const shouldHighlight = contentLength <= MAX_HIGHLIGHT_LENGTH;
  const isPlainText = language === "plaintext";

  // Tried startTransition approach - highlight operation still blocks the main thread
  useEffect(() => {
    if (!shouldHighlight || isPlainText || !content) {
      setHtml("");
      return;
    }

    let cancelled = false;

    highlighter
      .getHighlightedCode(content, language, theme)
      .then((result) => {
        if (!cancelled) {
          setHtml(result);
        }
      })
      .catch((err) => {
        console.error("Failed to get highlighted code:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [content, language, theme, shouldHighlight, isPlainText]);

  const shouldShowNoHighlightInfo = !isPlainText && !shouldHighlight;

  if (html) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

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
};

export default HighlightedCodeBlock;
