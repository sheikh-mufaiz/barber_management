import React from "react";

const MINUTE = 60000;

const getDateValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date.getTime() : 0;
};

const getBookingWaitMinutes = (booking, now = Date.now()) => {
  if (booking.status === "in-progress" && booking.actualStartTime) {
    const elapsed = (now - new Date(booking.actualStartTime).getTime()) / MINUTE;
    return Math.max(0, Math.floor((booking.totalTime || 0) - elapsed));
  }

  const startMs = getDateValue(booking.startTime);
  if (!startMs) return 0;

  return Math.max(0, Math.floor((startMs - now) / MINUTE));
};

const formatToken = (orderId) => {
  if (!orderId) return "Token Pending";

  return `Token #${String(orderId).slice(-4)}`;
};

const formatQueueTime = (minutes) => {
  if (minutes <= 0) return "Now";
  if (minutes === 1) return "1 min";
  return `${minutes} mins`;
};

const formatExpectedStart = (timeMs) => {
  if (!timeMs) return "Expected: --";

  return `Expected: ${new Date(timeMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })}`;
};

const getCurrentBookingStatus = (booking, now = Date.now()) => {
  if (!booking?.actualStartTime) {
    return "Ready to start";
  }

  const elapsedMinutes = Math.floor(
    (now - new Date(booking.actualStartTime).getTime()) / MINUTE
  );
  const totalMinutes = Math.max(0, Number(booking.totalTime || 0));
  const remainingMinutes = Math.max(0, Math.floor(totalMinutes - elapsedMinutes));

  if (remainingMinutes > 0) {
    return `${formatQueueTime(remainingMinutes)} left`;
  }

  const overrunMinutes = Math.max(0, elapsedMinutes - totalMinutes);
  return overrunMinutes > 0 ? `Running ${formatQueueTime(overrunMinutes)} over` : "Due now";
};

const getChairDelayMs = (booking, now = Date.now()) => {
  if (!booking?.actualStartTime) {
    return 0;
  }

  const plannedStartMs = getDateValue(booking.startTime);
  const actualStartMs = getDateValue(booking.actualStartTime);
  const plannedEndMs = getDateValue(booking.endTime) || plannedStartMs + getDurationMs(booking);
  const lateStartMs =
    plannedStartMs && actualStartMs ? Math.max(0, actualStartMs - plannedStartMs) : 0;
  const overrunMs = plannedEndMs ? Math.max(0, now - plannedEndMs) : 0;

  return Math.max(lateStartMs, overrunMs);
};

const getDurationMs = (booking) => Math.max(0, Number(booking?.totalTime || 0)) * MINUTE;

const sortBookings = (a, b) => {
  const startDiff = getDateValue(a.startTime) - getDateValue(b.startTime);
  if (startDiff !== 0) return startDiff;
  return getDateValue(a.createdAt) - getDateValue(b.createdAt);
};

export const deriveChairQueues = (chairs = [], bookings = [], now = Date.now()) => {
  const activeChairs = (Array.isArray(chairs) ? chairs : []).filter((chair) => chair?.isActive);
  const chairMap = new Map(activeChairs.map((chair) => [chair.id, chair]));
  const queueMap = new Map(activeChairs.map((chair) => [chair.id, []]));
  const unassigned = [];

  bookings.forEach((booking) => {
    if (booking?.chairId && queueMap.has(booking.chairId)) {
      queueMap.get(booking.chairId).push(booking);
      return;
    }

    if (!booking?.chairId || !chairMap.has(booking.chairId)) {
      unassigned.push(booking);
    }
  });

  const queues = activeChairs.map((chair) => {
    const chairBookings = (queueMap.get(chair.id) || []).slice().sort(sortBookings);
    const nowServing =
      chairBookings.find((booking) => booking.status === "in-progress") || null;
    const waitingBookings = chairBookings.filter((booking) => booking.status !== "in-progress");
    const readyBooking = !nowServing
      ? waitingBookings.find((booking) => getBookingWaitMinutes(booking, now) === 0) || null
      : null;
    const previewBooking = nowServing || readyBooking;
    const queuedNextBookings = readyBooking
      ? waitingBookings.filter((booking) => booking !== readyBooking).slice(0, 2)
      : waitingBookings.slice(0, 2);
    const liveDelayMs = getChairDelayMs(nowServing, now);
    const nextBookings = queuedNextBookings.map((booking) => {
      const baseStartMs = getDateValue(booking.startTime);
      const adjustedStartMs = baseStartMs ? baseStartMs + liveDelayMs : 0;
      const waitMinutes = adjustedStartMs
        ? Math.max(0, Math.floor((adjustedStartMs - now) / MINUTE))
        : 0;

      return {
        ...booking,
        displayStartMs: adjustedStartMs,
        displayWaitMinutes: waitMinutes
      };
    });
    const estimatedWait = readyBooking
      ? 0
      : nextBookings.length
      ? nextBookings[0].displayWaitMinutes
      : waitingBookings.length
      ? getBookingWaitMinutes(waitingBookings[0], now)
      : 0;

    return {
      chair,
      nowServing,
      readyBooking,
      nextBookings,
      estimatedWait
    };
  });

  if (unassigned.length) {
    const sorted = unassigned.slice().sort(sortBookings);
    const waitingBookings = sorted.filter((booking) => booking.status !== "in-progress");
    const readyBooking =
      waitingBookings.find((booking) => getBookingWaitMinutes(booking, now) === 0) || null;

    queues.push({
      chair: {
        id: "unassigned",
        name: "Unassigned",
        isActive: true
      },
      nowServing: sorted.find((booking) => booking.status === "in-progress") || null,
      readyBooking,
      nextBookings: (readyBooking
        ? waitingBookings.filter((booking) => booking !== readyBooking).slice(0, 2)
        : waitingBookings.slice(0, 2)
      ).map((booking) => ({
        ...booking,
        displayStartMs: getDateValue(booking.startTime),
        displayWaitMinutes: getBookingWaitMinutes(booking, now)
      })),
      estimatedWait: waitingBookings.length ? getBookingWaitMinutes(waitingBookings[0], now) : 0
    });
  }

  return queues;
};

function QueueBoard({ chairs = [], bookings = [], title = "Live Queue" }) {
  const chairQueues = deriveChairQueues(chairs, bookings);

  return (
    <section className="queue-board" aria-label={title}>
      <div className="queue-board__header">
        <div>
          <h3>{title}</h3>
          <p>Live chair-by-chair status with now serving, next up, and estimated wait.</p>
        </div>
      </div>

      {chairQueues.length === 0 ? (
        <div className="queue-card queue-card--empty">
          <p className="queue-empty-title">No active chairs yet</p>
          <p className="queue-empty-copy">
            Turn on a chair to start showing the real-time queue.
          </p>
        </div>
      ) : (
        <div className="queue-grid">
          {chairQueues.map(({ chair, nowServing, readyBooking, nextBookings, estimatedWait }) => {
            const currentBooking = nowServing || readyBooking;

            return (
              <article className="queue-card" key={chair.id}>
                <div className="queue-card__top">
                  <div>
                    <p className="queue-chair-label">{chair.name}</p>
                    <h4>{currentBooking ? formatToken(currentBooking.orderId) : "Chair Available"}</h4>
                  </div>

                  <span
                    className={`queue-status-badge ${
                      nowServing ? "queue-status-badge--active" : "queue-status-badge--idle"
                    }`}
                  >
                    {nowServing ? "Now Serving" : currentBooking ? "Ready Next" : "Open"}
                  </span>
                </div>

                <div className="queue-card__body">
                  <div className="queue-section">
                    <p className="queue-section__label">Current customer in chair</p>
                    {currentBooking ? (
                      <>
                        <p className="queue-primary">
                          {formatToken(currentBooking.orderId)}
                          {currentBooking.customerName ? (
                            <span className="queue-secondary">
                              {currentBooking.customerName}
                            </span>
                          ) : null}
                        </p>
                        <p className="queue-meta">
                          {nowServing ? getCurrentBookingStatus(currentBooking) : "Ready to start"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="queue-primary">No customer in chair</p>
                        <p className="queue-meta">This chair is currently free.</p>
                      </>
                    )}
                  </div>

                  <div className="queue-section">
                    <p className="queue-section__label">Waiting customers</p>
                    {nextBookings.length ? (
                      <ul className="queue-list">
                        {nextBookings.map((booking) => (
                          <li className="queue-list__item" key={booking._id || booking.orderId}>
                            <div>
                              <p className="queue-primary">
                                {formatToken(booking.orderId)}
                                {booking.customerName ? (
                                  <span className="queue-secondary">{booking.customerName}</span>
                                ) : null}
                              </p>
                              <p className="queue-meta">{formatExpectedStart(booking.displayStartMs)}</p>
                            </div>
                            <span className="queue-wait-pill">
                              {formatQueueTime(booking.displayWaitMinutes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="queue-meta">No one waiting for this chair.</p>
                    )}
                  </div>
                </div>

                <div className="queue-card__footer">
                  <span>Estimated Wait</span>
                  <strong>{formatQueueTime(estimatedWait)}</strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default QueueBoard;
