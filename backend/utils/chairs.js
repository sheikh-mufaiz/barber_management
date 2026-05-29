const normalizeChairSessions = (sessions = []) =>
  Array.isArray(sessions)
    ? sessions
        .map((session) => {
          const startedAt = new Date(session?.startedAt);
          const endedAt = session?.endedAt ? new Date(session.endedAt) : null;

          if (Number.isNaN(startedAt.getTime())) {
            return null;
          }

          return {
            startedAt,
            endedAt:
              endedAt && !Number.isNaN(endedAt.getTime()) && endedAt >= startedAt
                ? endedAt
                : null
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.startedAt - b.startedAt)
    : [];

const createDefaultChair = (index = 1) => ({
  id: `chair-${index}`,
  name: `Chair ${index}`,
  isActive: true,
  sessions: []
});

const sanitizeChairs = (chairs) => {
  if (!Array.isArray(chairs)) {
    return [createDefaultChair(1)];
  }

  const normalized = chairs
    .map((chair, index) => {
      const name = String(chair?.name || "").trim();

      if (!name) {
        return null;
      }

      return {
        id:
          typeof chair?.id === "string" && chair.id.trim()
            ? chair.id.trim()
            : `chair-${Date.now()}-${index + 1}`,
        name,
        isActive: chair?.isActive !== false,
        sessions: normalizeChairSessions(chair?.sessions)
      };
    })
    .filter(Boolean);

  return normalized.length ? normalized : [createDefaultChair(1)];
};

const getActiveChairs = (chairs) => sanitizeChairs(chairs).filter((chair) => chair.isActive);

const findChairById = (chairs, chairId) =>
  sanitizeChairs(chairs).find((chair) => chair.id === chairId) || null;

const startChairSession = (chair, now = new Date()) => {
  const sessions = normalizeChairSessions(chair?.sessions);

  if (sessions.some((session) => session.endedAt === null)) {
    return {
      ...chair,
      sessions
    };
  }

  return {
    ...chair,
    sessions: [
      ...sessions,
      {
        startedAt: now,
        endedAt: null
      }
    ]
  };
};

const closeChairSession = (chair, now = new Date()) => {
  const sessions = normalizeChairSessions(chair?.sessions);
  const openIndex = sessions.findIndex((session) => session.endedAt === null);

  if (openIndex < 0) {
    return {
      ...chair,
      sessions
    };
  }

  return {
    ...chair,
    sessions: sessions.map((session, index) =>
      index === openIndex
        ? {
            ...session,
            endedAt: now
          }
        : session
    )
  };
};

const openSessionsForChairs = (chairs, now = new Date()) =>
  sanitizeChairs(chairs).map((chair) =>
    chair.isActive ? startChairSession(chair, now) : { ...chair, sessions: normalizeChairSessions(chair.sessions) }
  );

const closeSessionsForChairs = (chairs, now = new Date()) =>
  sanitizeChairs(chairs).map((chair) => closeChairSession(chair, now));

const setAllChairsActiveState = (chairs, isActive) =>
  sanitizeChairs(chairs).map((chair) => ({
    ...chair,
    isActive
  }));

const restoreChairStates = (chairs, activeChairIds = []) => {
  const activeIdSet = new Set(
    Array.isArray(activeChairIds)
      ? activeChairIds.filter((chairId) => typeof chairId === "string" && chairId.trim())
      : []
  );

  return sanitizeChairs(chairs).map((chair) => ({
    ...chair,
    isActive: activeIdSet.has(chair.id)
  }));
};

const reconcileChairSessions = ({
  previousChairs = [],
  nextChairs = [],
  isShopOpen = false,
  now = new Date()
}) => {
  const normalizedPrevious = sanitizeChairs(previousChairs);
  const normalizedNext = sanitizeChairs(nextChairs);
  const previousById = normalizedPrevious.reduce((map, chair) => {
    map[chair.id] = chair;
    return map;
  }, {});

  return normalizedNext.map((chair) => {
    const previous = previousById[chair.id];

    if (!previous) {
      return isShopOpen && chair.isActive ? startChairSession(chair, now) : chair;
    }

    const previousIsActive = previous.isActive !== false;
    const nextIsActive = chair.isActive !== false;
    let reconciled = {
      ...chair,
      // Existing chair history lives on the server; incoming payloads should not replace it.
      sessions: normalizeChairSessions(previous.sessions)
    };

    if (isShopOpen && !previousIsActive && nextIsActive) {
      reconciled = startChairSession(reconciled, now);
    }

    if (isShopOpen && previousIsActive && !nextIsActive) {
      reconciled = closeChairSession(reconciled, now);
    }

    return reconciled;
  });
};

module.exports = {
  closeChairSession,
  closeSessionsForChairs,
  createDefaultChair,
  findChairById,
  getActiveChairs,
  normalizeChairSessions,
  openSessionsForChairs,
  reconcileChairSessions,
  restoreChairStates,
  sanitizeChairs,
  setAllChairsActiveState,
  startChairSession
};
