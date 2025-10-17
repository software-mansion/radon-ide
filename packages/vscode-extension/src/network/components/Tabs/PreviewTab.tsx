import { useEffect, useRef, useState } from "react";
import { NetworkLog, NetworkLogColumn } from "../../types/networkLog";
import { ContentTypeHeader, ResponseBodyData } from "../../types/network";
import { isPreviewableImage } from "../../utils/requestFormatters";
import { NetworkEvent } from "../../types/panelMessageProtocol";
import { useLogDetailsBar } from "../../providers/LogDetailsBar";
import { getNetworkLogValue } from "../../utils/networkLogParsers";
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

// Helper functions
const calculateGCD = (a: number, b: number): number => (b === 0 ? a : calculateGCD(b, a % b));

const calculateAspectRatio = (width: number, height: number): string => {
  const divisor = calculateGCD(width, height);
  return `${width / divisor}:${height / divisor}`;
};

const getContentType = (networkLog: NetworkLog): string => {
  const headers = networkLog.response?.headers || {};
  return headers[ContentTypeHeader.Default] || headers[ContentTypeHeader.LowerCase] || "";
};

const createImageUrl = (contentType: string, body: string, base64Encoded: boolean): string => {
  return base64Encoded
    ? `data:${contentType};base64,${body}`
    : `data:${contentType};base64,${btoa(body)}`;
};

// Components
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

function PreviewTab({ networkLog, responseBodyData }: PreviewTabProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const { setContent, setIsVisible } = useLogDetailsBar();

  const [loading, setLoading] = useState(!imageRef.current?.complete);
  const [error, setError] = useState(false);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);

  // Extract response body data
  const { body, fullBody, base64Encoded = false, wasTruncated = false } = responseBodyData || {};

  // Determine preview availability
  const contentType = getContentType(networkLog);
  const canPreview = isPreviewableImage(contentType);
  const imageSize = getNetworkLogValue(networkLog, NetworkLogColumn.Size) || "";

  // Determine display states
  const requestFailed = networkLog.currentState === NetworkEvent.LoadingFailed;
  const dataFetchFailed = requestFailed && !body;
  const isFullBodyNotAvailable = !fullBody && wasTruncated;
  const isImageLoading = loading && !error;

  // Reset loading state when request changes
  useEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }
    setLoading(!image.complete);
    setError(false);
  }, [networkLog.requestId]);

  // Calculate and set image metadata when loading completes
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
  }, [loading, networkLog.requestId, contentType, imageSize]);

  // Manage info bar visibility
  useEffect(() => {
    setIsVisible(true);
    return () => setIsVisible(false);
  }, [setIsVisible]);

  // Update info bar content with metadata
  useEffect(() => {
    if (metadata) {
      setContent(<PreviewInfoBar metadata={metadata} />);
    }
    return () => setContent(null);
  }, [metadata, setContent]);

  // Render error states
  if (dataFetchFailed) {
    return (
      <div className="tab-padding">
        <div className="preview-tab-container">
          <div className="preview-tab-failed-fetch-information">
            <h4>Failed to load response data</h4>
          </div>
        </div>
      </div>
    );
  }

  if (!canPreview || !body || isFullBodyNotAvailable) {
    return (
      <div className="tab-padding">
        <div className="preview-tab-content">
          <div className="preview-tab-no-preview">
            <span className="codicon codicon-file-media" />
            <p>No preview available</p>
          </div>
        </div>
      </div>
    );
  }

  // Render image preview
  const imageBody = fullBody || body;
  const imageUrl = createImageUrl(contentType, imageBody, base64Encoded);

  const handleImageLoad = () => setLoading(false);

  const handleImageError = () => {
    if (!loading) {
      setError(true);
    }
  };

  return (
    <div className="tab-padding">
      <div className="preview-tab-content">
        <img
          ref={imageRef}
          src={imageUrl}
          style={{ display: loading || error ? "none" : "block" }}
          alt="Response preview"
          className="preview-tab-image"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        {isImageLoading && (
          <div className="preview-tab-loading">
            <span className="codicon codicon-info" />
            <p>Loading...</p>
          </div>
        )}
        {error && (
          <div className="preview-tab-error">
            <span className="codicon codicon-error" />
            <p>Error loading image</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PreviewTab;
