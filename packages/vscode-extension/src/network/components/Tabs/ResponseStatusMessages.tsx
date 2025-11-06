import "./ResponseStatusMessages.css";

export function ResponseTooLargeWarning() {
  return (
    <pre className="response-tab-truncated-warning">
      <span className="codicon codicon-warning" /> Response too large, showing truncated data.
    </pre>
  );
}

export function ResponseLoadingInfo() {
  return (
    <div className="preview-tab-loading">
      <span className="codicon codicon-info" />
      <p>Loading...</p>
    </div>
  );
}

export function ResponseDataFetchFailedInfo() {
  return (
    <div className="response-tab-failed-fetch-information">
      <span className="codicon codicon-info" />
      <p>Failed to load response data</p>
    </div>
  );
}

export function PreviewImageError() {
  return (
    <div className="preview-tab-error">
      <span className="codicon codicon-error" />
      <p>Error loading image</p>
    </div>
  );
}

export function NoPreviewAvailableInfo() {
  return (
    <div className="preview-tab-no-preview">
      <span className="codicon codicon-file-media" />
      <p>No preview available</p>
    </div>
  );
}
