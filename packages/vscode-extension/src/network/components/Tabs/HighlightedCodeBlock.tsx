import { useEffect, useState } from "react";

import { ThemeData } from "../../../common/theme";
import { useHighlighter } from "../../providers/HighlighterProvider";
import "./PayloadAndResponseTab.css";

interface HighlightedCodeBlockProps {
  content: string | undefined;
  language?: string;
  theme?: ThemeData;
  placeholder?: string;
  className?: string;
  isActive?: boolean;
  showTruncatedWarning?: boolean;
}

/**
 * Maximum content length (in characters) to apply syntax highlighting
 * For larger content, plain text will be displayed to avoid performance issues
 */
const MAX_HIGHLIGHT_LENGTH = 65_000;

const HighlightedCodeBlock = ({
  content,
  language = "plaintext",
  theme,
  placeholder = "No content",
  className = "response-tab-pre",
  isActive = false,
  showTruncatedWarning = false,
}: HighlightedCodeBlockProps) => {
  const highlighter = useHighlighter();
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const isPlainText = language === "plaintext";
  const contentTooLarge = !!content && content.length > MAX_HIGHLIGHT_LENGTH;
  const canHighlight = !!content && !isPlainText && !contentTooLarge;
  const showSizeWarning = contentTooLarge && !isPlainText;

  useEffect(() => {
    if (!canHighlight) {
      setHighlightedHtml("");
      return;
    }

    let cancelled = false;

    highlighter.isCodeCached(content, language, theme).then(async (isCached) => {
      if (!isCached && !isActive) {
        setHighlightedHtml("");
        return;
      }

      try {
        const result = await highlighter.getHighlightedCode(content, language, theme);
        if (!cancelled) {
          setHighlightedHtml(result);
        }
      } catch (error) {
        console.error("Failed to highlight code:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canHighlight, isActive, content, language, theme, highlighter]);

  return (
    <>
      {showTruncatedWarning && (
        <pre className="response-tab-truncated-warning">
          <span className="codicon codicon-warning" /> Response too large, showing truncated data.
        </pre>
      )}
      {showSizeWarning && (
        <pre className="no-highlight-info">
          <span className="codicon codicon-info" /> Content too large for syntax highlighting.
        </pre>
      )}
      {highlightedHtml ? (
        <div className={className} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      ) : (
        <pre className={className}>{content ?? placeholder}</pre>
      )}
    </>
  );
};

export default HighlightedCodeBlock;
