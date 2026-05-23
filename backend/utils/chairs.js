const createDefaultChair = (index = 1) => ({
  id: `chair-${index}`,
  name: `Chair ${index}`,
  isActive: true
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
        isActive: chair?.isActive !== false
      };
    })
    .filter(Boolean);

  return normalized.length ? normalized : [createDefaultChair(1)];
};

const getActiveChairs = (chairs) => sanitizeChairs(chairs).filter((chair) => chair.isActive);

const findChairById = (chairs, chairId) =>
  sanitizeChairs(chairs).find((chair) => chair.id === chairId) || null;

module.exports = {
  createDefaultChair,
  sanitizeChairs,
  getActiveChairs,
  findChairById
};
