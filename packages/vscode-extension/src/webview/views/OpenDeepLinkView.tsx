import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Label from "../components/shared/Label";
import "./OpenDeepLinkView.css";
import Button from "../components/shared/Button";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";

type HistoryElement = {
  id: number;
  url: string;
};

export const OpenDeepLinkView = () => {
  const { project } = useProject();
  const { closeModal } = useModal();

  const [history, setHistory] = useState<HistoryElement[]>([]);
  const [displayedHistory, setDisplayedHistory] = useState<HistoryElement[]>([]);
  const [url, setUrl] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<number | undefined>(undefined);
  const highlightedSegment = useRef<Map<number, [number, number]>>(new Map());

  useEffect(() => {
    (async () => {
      const deepLinksHistory = await project.getDeepLinksHistory();
      const historyWithIds = deepLinksHistory.map((element, index) => ({
        id: index,
        url: element,
      }));
      setHistory(historyWithIds);
      setDisplayedHistory(historyWithIds);

      if (deepLinksHistory.length > 0) {
        setUrl(deepLinksHistory[0]);
        setSelectedElement(0);
      }
    })();
  }, []);

  const updateUrl = (newUrl: string, selectedElementId?: number) => {
    setUrl(newUrl);

    if (selectedElementId !== undefined) {
      setSelectedElement(selectedElementId);
    } else {
      setSelectedElement(undefined);
    }
  };

  useEffect(() => {
    if (!query) {
      setDisplayedHistory(history);
      highlightedSegment.current.clear();
      return;
    }

    let newDisplayedHistory: HistoryElement[] = [];

    history.forEach((historyElement) => {
      const queryPosition = historyElement.url.indexOf(query);

      if (queryPosition !== -1) {
        newDisplayedHistory.push(historyElement);
        highlightedSegment.current.set(historyElement.id, [
          queryPosition,
          queryPosition + query.length,
        ]);
      }
    });

    setDisplayedHistory(newDisplayedHistory);
  }, [query]);

  const openDeepLink = async () => {
    if (!url) {
      return;
    }

    await project.openDeepLink(url);

    closeModal();
  };

  const getHistoryUrlWithHighlight = (element: HistoryElement): ReactNode => {
    const segment = highlightedSegment.current.get(element.id);
    if (segment === undefined) {
      return <span>{element.url}</span>;
    } else {
      const [left, right] = segment;
      return (
        <>
          <span>
            {element.url.substring(0, left)}
            <span className="url-highlighted">{element.url.substring(left, right)}</span>
            {element.url.substring(right)}
          </span>
        </>
      );
    }
  };

  return (
    <>
      <Label>URL</Label>
      <input
        className="input-url"
        type="string"
        value={url}
        placeholder="Input Deep Link URL"
        onChange={(e) => updateUrl(e.target.value)}
      />
      <Label>History</Label>
      <div className="search-bar-wrapper">
        <span className="codicon codicon-search search-icon" />
        <input
          className="input-url"
          type="string"
          value={query}
          placeholder="Type to search"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="history-container">
        {displayedHistory.length > 0 ? (
          displayedHistory.map((historyElement) => (
            <div
              key={`history-element-${historyElement.id}`}
              className={`history-option ${
                selectedElement === historyElement.id && "selected-element"
              }`}
              onClick={() => updateUrl(historyElement.url, historyElement.id)}>
              {getHistoryUrlWithHighlight(historyElement)}
            </div>
          ))
        ) : (
          <div className="empty-history">no entries found</div>
        )}
      </div>
      <div className="submit-button-container">
        <Button className="submit-button" type="secondary" onClick={openDeepLink}>
          Open
        </Button>
      </div>
    </>
  );
};
