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
  requestId: string | number;
  isActive?: boolean;
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
  requestId,
  isActive,
}: HighlightedCodeBlockProps) => {
  const highlighter = useHighlighter();
  const [html, setHtml] = useState<string>("");

  const isPlainText = language === "plaintext";
  const contentTooLarge = (content?.length ?? 0) > MAX_HIGHLIGHT_LENGTH;
  const triggerTooLargeInfo = contentTooLarge && !isPlainText;
  const canHighlight = content && !isPlainText && !contentTooLarge;

  useEffect(() => {
    const shouldHighlightCode =
      canHighlight && (isActive || highlighter.isCodeCached(content, language, theme, requestId));

    if (!shouldHighlightCode) {
      setHtml("");
      return;
    }

    let cancelled = false;

    highlighter
      .getHighlightedCode(content, language, theme, requestId)
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
  }, [isActive, content, language, theme]);

  if (html) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <>
      {triggerTooLargeInfo && (
        <pre className="no-highlight-info">
          <span className="codicon codicon-info" /> Content too large for syntax highlighting.
        </pre>
      )}
      <pre className={className}>{content ?? placeholder}</pre>
    </>
  );
};

export default HighlightedCodeBlock;
