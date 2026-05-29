import React from "react";

function LoadingBlock({ variant = "lines", count = 3, className = "" }) {
  if (variant === "cards") {
    return (
      <div className={`ui-skeleton-grid ${className}`.trim()} aria-busy="true" aria-label="Loading">
        {Array.from({ length: count }).map((_, index) => (
          <div className="ui-skeleton-card" key={index} />
        ))}
      </div>
    );
  }

  if (variant === "analytics") {
    return (
      <div className={`ui-skeleton-analytics ${className}`.trim()} aria-busy="true" aria-label="Loading">
        <div className="ui-skeleton-grid ui-skeleton-grid--metrics">
          <div className="ui-skeleton-card ui-skeleton-card--metric" />
          <div className="ui-skeleton-card ui-skeleton-card--metric" />
        </div>
        <div className="ui-skeleton-panel" />
        <div className="ui-skeleton-panel ui-skeleton-panel--tall" />
      </div>
    );
  }

  return (
    <div className={`ui-skeleton-lines ${className}`.trim()} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className={`ui-skeleton-line ${index === 0 ? "ui-skeleton-line--short" : ""}`}
          key={index}
        />
      ))}
    </div>
  );
}

export default LoadingBlock;
