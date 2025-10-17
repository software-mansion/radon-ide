import { useEffect, useRef, useState } from "react";
import { NetworkLog } from "../../types/networkLog";
import { ResponseBodyData } from "../../types/network";
import { isPreviewableImage } from "../../utils/requestFormatters";
import { NetworkEvent } from "../../types/panelMessageProtocol";
import { useLogDetailsBar } from "../../providers/LogDetailsBar";
import { getNetworkLogValue } from "../../utils/networkLogParsers";
import { NetworkLogColumn } from "../../types/networkLog";
import "./PreviewTab.css";
import "./PayloadAndResponseTab.css";

interface PreviewTabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
}

interface ImageMetadata {
  size: string;
  resolution: string;
  aspectRatio: string;
  mime: string;
}

function PreviewInfoBar({ metadata }: { metadata: ImageMetadata }) {
  return (
    <div className="preview-bar">
      <div>{metadata.size}</div>
      <div>{metadata.resolution}</div>
      <div>{metadata.aspectRatio}</div>
      <div>{metadata.mime}</div>
    </div>
  );
}

function calculateAspectRatio(width: number, height: number) {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

const PreviewTab = ({ networkLog, responseBodyData }: PreviewTabProps) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const { setContent, setIsVisible } = useLogDetailsBar();

  const [loading, setLoading] = useState(!imageRef.current?.complete);
  const [error, setError] = useState<boolean>(false);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);

  const {
    body = undefined,
    fullBody = undefined,
    base64Encoded = false,
    wasTruncated = false,
  } = responseBodyData || {};

  const requestFailed = networkLog.currentState === NetworkEvent.LoadingFailed;
  const noFullBodyAvailable = !fullBody && wasTruncated;
  const dataFetchFailure = requestFailed && !body;
  const displayLoading = loading && !error;

  const contentType =
    networkLog.response?.headers?.["Content-Type"] ||
    networkLog.response?.headers?.["content-type"] ||
    "";
  const canPreview = isPreviewableImage(contentType);

  const imageSize = getNetworkLogValue(networkLog, NetworkLogColumn.Size) || "";

  useEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }
    setLoading(!image.complete);
    setError(false);
  }, [networkLog.requestId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const naturalWidth = imageRef.current?.naturalWidth || 0;
    const naturalHeight = imageRef.current?.naturalHeight || 0;

    setMetadata({
      mime: contentType,
      resolution: `${naturalWidth} × ${naturalHeight}`,
      aspectRatio: calculateAspectRatio(naturalWidth, naturalHeight),
      size: imageSize,
    });
  }, [loading, networkLog.requestId]);

  useEffect(() => {
    setIsVisible(true);
    return () => setIsVisible(false);
  }, [setIsVisible]);

  // Update the info bar content when metadata is available
  useEffect(() => {
    if (metadata) {
      setContent(<PreviewInfoBar metadata={metadata} />);
    }
    return () => setContent(null);
  }, [metadata, setContent]);

  if (dataFetchFailure) {
    return (
      <div className="preview-tab-container">
        <div className="preview-tab-failed-fetch-information">
          <h4>Failed to load response data</h4>
        </div>
      </div>
    );
  }

  if (!canPreview || !body || noFullBodyAvailable) {
    return (
      <div className="preview-tab-container">
        <div className="preview-tab-no-preview">
          <span className="codicon codicon-file-media" />
          <p>No preview available</p>
        </div>
      </div>
    );
  }

  const imageUrl = base64Encoded
    ? `data:${contentType};base64,${fullBody || body}`
    : `data:${contentType};base64,${btoa(fullBody || body)}`;

  return (
    <>
      <div className="tab-padding">
        <div className="preview-tab-content">
          <img
            ref={imageRef}
            src={imageUrl}
            style={{ display: loading || error ? "none" : "block" }}
            alt="Response preview"
            className="preview-tab-image"
            onLoad={(e) => {
              setLoading(false);
            }}
            onError={(e) => {
              if (!loading) {
                setError(true);
              }
            }}
          />
          {displayLoading && (
            <div className="response-tab-failed-fetch-information">
              <span className="codicon codicon-info" />
              <h4>Loading...</h4>
            </div>
          )}
          {error && (
            <div className="preview-tab-error ">
              <span className="codicon codicon-error" />
              <p>Error loading image</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PreviewTab;
