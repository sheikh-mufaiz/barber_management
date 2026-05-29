import React from "react";

function EmptyState({ title, description, actionLabel, onAction, className = "" }) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      <div className="ui-empty__icon" aria-hidden="true" />
      <h3 className="ui-empty__title">{title}</h3>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {actionLabel && onAction ? (
        <button className="app-button app-button--secondary" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default EmptyState;
