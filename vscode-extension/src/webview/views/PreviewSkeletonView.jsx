import React from "react";
import "./PreviewSkeletonView.css";

function PreviewSkeletonView() {
  return (
    <div className="panel-view">
      <div className="button-group" />
      <div className="phone-content-skeleton skeleton-animation" />
      <div className="button-group" />
    </div>
  );
}

export default PreviewSkeletonView;
