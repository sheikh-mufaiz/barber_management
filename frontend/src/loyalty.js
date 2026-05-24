export const formatCurrency = (amount = 0) => `Rs ${Number(amount || 0)}`;

export const getBadgeClassName = (badge = "New") => {
  if (badge === "VIP") {
    return "loyalty-badge loyalty-badge--vip";
  }

  if (badge === "Regular") {
    return "loyalty-badge loyalty-badge--regular";
  }

  return "loyalty-badge loyalty-badge--new";
};

export const getDefaultProfile = ({ barberId = "", customerId = "", customerName = "" } = {}) => ({
  barberId,
  customerId,
  customerName,
  visitCount: 0,
  totalSpend: 0,
  badge: "New",
  favoriteServices: [],
  topService: null,
  recentBookings: []
});
