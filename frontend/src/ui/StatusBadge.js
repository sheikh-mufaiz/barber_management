import React from "react";

const STATUS_LABELS = {
  booked: "Booked",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  ready: "Ready",
  waiting: "Waiting",
  open: "Open",
  closed: "Closed"
};

function StatusBadge({ status, label, className = "" }) {
  const normalized = String(status || "").toLowerCase();
  const displayLabel = label || STATUS_LABELS[normalized] || status;

  return (
    <span className={`status-badge status-badge--${normalized} ${className}`.trim()}>
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
