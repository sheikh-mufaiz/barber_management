import React from "react";

function ToastStack({ notifications = [], onDismiss }) {
  if (!notifications.length) {
    return null;
  }

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={`toast toast--${notification.variant || "info"}`}
          role="status"
          aria-live="polite"
        >
          <div className="toast__content">
            {notification.title ? <p className="toast__title">{notification.title}</p> : null}
            <p className="toast__message">{notification.message}</p>
          </div>

          <button
            type="button"
            className="toast__close"
            aria-label={`Dismiss ${notification.title || "notification"}`}
            onClick={() => onDismiss(notification.id)}
          >
            x
          </button>
        </article>
      ))}
    </div>
  );
}

export default ToastStack;
