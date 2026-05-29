import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BarberDashboard from "./BarberDashboard";

jest.mock("./QueueBoard", () => function QueueBoardMock({ title }) {
  return <div>{title}</div>;
});

const createFetchResponse = (data) =>
  Promise.resolve({
    ok: true,
    json: async () => data
  });

const createErrorResponse = (data, status = 400) =>
  Promise.resolve({
    ok: false,
    status,
    json: async () => data
  });

const buildAnalyticsResponse = ({
  totalBookings,
  estimatedRevenue,
  servicePopularity,
  peakBookingHours,
  totalPlatformBookings,
  customerGrowth,
  cancellationRate,
  totalBarbers,
  openShops,
  myShopIsOpen = true,
  myTotalBookings = totalBookings,
  myCustomerGrowth = customerGrowth,
  myCancellationRate = cancellationRate,
  topPerformingShops,
  chairMetrics
}) => ({
  range: {
    preset: "today",
    start: "2026-05-24T00:00:00.000Z",
    end: "2026-05-24T23:59:59.999Z"
  },
  barberMetrics: {
    totalBookings,
    estimatedRevenue,
    servicePopularity,
    peakBookingHours
  },
  chairMetrics,
  platformMetrics: {
    allBarberOverview: {
      totalBarbers,
      openShops
    },
    totalPlatformBookings,
    customerGrowth,
    cancellationRate,
    topPerformingShops
  },
  barberOverviewMetrics: {
    shopOverview: {
      isOpen: myShopIsOpen
    },
    totalBookings: myTotalBookings,
    customerGrowth: myCustomerGrowth,
    cancellationRate: myCancellationRate
  },
  topPerformingShops
});

const analyticsByPreset = {
  today: buildAnalyticsResponse({
    totalBookings: 1,
    estimatedRevenue: 100,
    servicePopularity: [["Haircut", 1]],
    peakBookingHours: [["09:00", 1]],
    totalPlatformBookings: 3,
    customerGrowth: 2,
    cancellationRate: 33.3,
    totalBarbers: 2,
    openShops: 1,
    myTotalBookings: 2,
    myCustomerGrowth: 1,
    myCancellationRate: 50,
    chairMetrics: {
      summary: {
        busiestChairId: "chair-1",
        busiestChairName: "Chair 1",
        busiestChairBookings: 2,
        topRevenueChairId: "chair-1",
        topRevenueChairName: "Chair 1",
        topRevenue: 150,
        totalChairRevenue: 150,
        unassignedRevenue: 25
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 2,
          totalServiceMinutes: 45,
          averageServiceMinutes: 22.5,
          estimatedRevenue: 150,
          completedRevenue: 50,
          averageBookingValue: 75,
          revenuePerServiceHour: 200,
          revenueHistory: [
            {
              date: "2026-05-24",
              revenue: 150,
              transactions: [
                {
                  bookingId: "booking-2",
                  orderId: "5678",
                  customerName: "Riya",
                  services: ["Wax"],
                  status: "completed",
                  revenue: 50,
                  eventTime: "2026-05-24T09:30:00.000Z"
                },
                {
                  bookingId: "booking-1",
                  orderId: "1234",
                  customerName: "Aman",
                  services: ["Haircut"],
                  status: "booked",
                  revenue: 100,
                  eventTime: "2026-05-24T10:00:00.000Z"
                }
              ]
            }
          ],
          utilizationRate: 3.1,
          idleMinutes: 1395
        }
      ]
    },
    topPerformingShops: [
      { barberId: "barber-1", shopName: "Style Studio", barberName: "Barber One", bookings: 2 },
      { barberId: "barber-2", shopName: "Fade House", barberName: "Barber Two", bookings: 1 }
    ]
  }),
  week: buildAnalyticsResponse({
    totalBookings: 4,
    estimatedRevenue: 450,
    servicePopularity: [["Haircut", 3], ["Wax", 1]],
    peakBookingHours: [["10:00", 2], ["14:00", 2]],
    totalPlatformBookings: 8,
    customerGrowth: 5,
    cancellationRate: 12.5,
    totalBarbers: 3,
    openShops: 2,
    myTotalBookings: 5,
    myCustomerGrowth: 3,
    myCancellationRate: 20,
    chairMetrics: {
      summary: {
        busiestChairId: "chair-1",
        busiestChairName: "Chair 1",
        busiestChairBookings: 4,
        topRevenueChairId: "chair-1",
        topRevenueChairName: "Chair 1",
        topRevenue: 450,
        totalChairRevenue: 450,
        unassignedRevenue: 0
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 4,
          totalServiceMinutes: 90,
          averageServiceMinutes: 22.5,
          estimatedRevenue: 450,
          completedRevenue: 250,
          averageBookingValue: 112.5,
          revenuePerServiceHour: 300,
          revenueHistory: [
            {
              date: "2026-05-24",
              revenue: 450,
              transactions: [
                {
                  bookingId: "week-booking-1",
                  orderId: "wk-1",
                  customerName: "Aman",
                  services: ["Haircut", "Wax"],
                  status: "completed",
                  revenue: 450,
                  eventTime: "2026-05-24T10:00:00.000Z"
                }
              ]
            }
          ],
          utilizationRate: 0.9,
          idleMinutes: 9990
        }
      ]
    },
    topPerformingShops: [
      { barberId: "barber-1", shopName: "Style Studio", barberName: "Barber One", bookings: 4 }
    ]
  }),
  month: buildAnalyticsResponse({
    totalBookings: 9,
    estimatedRevenue: 980,
    servicePopularity: [["Haircut", 5], ["Wax", 2], ["Beard", 2]],
    peakBookingHours: [["11:00", 3]],
    totalPlatformBookings: 20,
    customerGrowth: 11,
    cancellationRate: 20,
    totalBarbers: 4,
    openShops: 3,
    myTotalBookings: 10,
    myCustomerGrowth: 6,
    myCancellationRate: 10,
    chairMetrics: {
      summary: {
        busiestChairId: "chair-2",
        busiestChairName: "Chair 2",
        busiestChairBookings: 6,
        topRevenueChairId: "chair-2",
        topRevenueChairName: "Chair 2",
        topRevenue: 680,
        totalChairRevenue: 980,
        unassignedRevenue: 0
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 3,
          totalServiceMinutes: 60,
          averageServiceMinutes: 20,
          estimatedRevenue: 300,
          completedRevenue: 200,
          averageBookingValue: 100,
          revenuePerServiceHour: 300,
          revenueHistory: [
            {
              date: "2026-05-12",
              revenue: 300,
              transactions: [
                {
                  bookingId: "month-booking-1",
                  orderId: "mo-1",
                  customerName: "Aman",
                  services: ["Haircut", "Wax"],
                  status: "completed",
                  revenue: 300,
                  eventTime: "2026-05-12T11:00:00.000Z"
                }
              ]
            }
          ],
          utilizationRate: 0.1,
          idleMinutes: 44580
        },
        {
          chairId: "chair-2",
          chairName: "Chair 2",
          isActive: false,
          bookingCount: 6,
          totalServiceMinutes: 180,
          averageServiceMinutes: 30,
          estimatedRevenue: 680,
          completedRevenue: 500,
          averageBookingValue: 113.3,
          revenuePerServiceHour: 226.7,
          revenueHistory: [
            {
              date: "2026-05-05",
              revenue: 200,
              transactions: [
                {
                  bookingId: "month-booking-2",
                  orderId: "mo-2",
                  customerName: "Riya",
                  services: ["Beard"],
                  status: "completed",
                  revenue: 200,
                  eventTime: "2026-05-05T13:00:00.000Z"
                }
              ]
            },
            {
              date: "2026-05-24",
              revenue: 480,
              transactions: [
                {
                  bookingId: "month-booking-3",
                  orderId: "mo-3",
                  customerName: "Kabir",
                  services: ["Haircut", "Beard"],
                  status: "booked",
                  revenue: 480,
                  eventTime: "2026-05-24T15:00:00.000Z"
                }
              ]
            }
          ],
          utilizationRate: 0.4,
          idleMinutes: 44460
        }
      ]
    },
    topPerformingShops: [
      { barberId: "barber-3", shopName: "Clip Joint", barberName: "Barber Three", bookings: 7 }
    ]
  }),
  customFilled: buildAnalyticsResponse({
    totalBookings: 0,
    estimatedRevenue: 0,
    servicePopularity: [],
    peakBookingHours: [],
    totalPlatformBookings: 0,
    customerGrowth: 0,
    cancellationRate: 0,
    totalBarbers: 2,
    openShops: 1,
    myTotalBookings: 0,
    myCustomerGrowth: 0,
    myCancellationRate: 0,
    chairMetrics: {
      summary: {
        busiestChairId: null,
        busiestChairName: "No chair activity",
        busiestChairBookings: 0,
        topRevenueChairId: null,
        topRevenueChairName: "No chair revenue",
        topRevenue: 0,
        totalChairRevenue: 0,
        unassignedRevenue: 0
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 0,
          totalServiceMinutes: 0,
          averageServiceMinutes: 0,
          estimatedRevenue: 0,
          completedRevenue: 0,
          averageBookingValue: 0,
          revenuePerServiceHour: 0,
          revenueHistory: [],
          utilizationRate: 0,
          idleMinutes: 2880
        }
      ]
    },
    topPerformingShops: []
  })
};

describe("BarberDashboard navigation", () => {
  let mockChairs;
  let mockIsOpen;

  beforeEach(() => {
    mockIsOpen = true;
    mockChairs = [{ id: "chair-1", name: "Chair 1", isActive: true }];
    window.alert = jest.fn();

    localStorage.setItem(
      "user",
      JSON.stringify({
        _id: "barber-1",
        name: "Barber One",
        role: "barber",
        isOpen: true
      })
    );

    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/services/")) {
        return createFetchResponse([
          { _id: "svc-1", name: "Haircut", duration: 15, price: 100 },
          { _id: "svc-2", name: "Wax", duration: 10, price: 50 }
        ]);
      }

      if (url.includes("/toggle-shop/")) {
        mockIsOpen = !mockIsOpen;
        mockChairs = mockIsOpen
          ? [
              { id: "chair-1", name: "Chair 1", isActive: true },
              { id: "chair-2", name: "Chair 2", isActive: false }
            ]
          : mockChairs.map((chair) => ({ ...chair, isActive: false }));

        return createFetchResponse({ message: "Status updated", isOpen: mockIsOpen });
      }

      if (url.includes("/chairs/")) {
        if (options.method === "PUT") {
          const body = JSON.parse(options.body || "{}");
          mockChairs = body.chairs || [];
          return createFetchResponse({ message: "Chairs updated", chairs: mockChairs });
        }

        return createFetchResponse(mockChairs);
      }

      if (url.includes("/estimate-booking")) {
        const body = JSON.parse(options.body || "{}");

        return createFetchResponse({
          available: true,
          estimatedStartTime:
            body.bookingType === "scheduled"
              ? "2026-05-24T13:00:00.000Z"
              : "2026-05-24T12:00:00.000Z",
          estimatedEndTime:
            body.bookingType === "scheduled"
              ? "2026-05-24T13:15:00.000Z"
              : "2026-05-24T12:15:00.000Z",
          chairId: "chair-1",
          chairName: "Chair 1",
          waitMinutes: body.bookingType === "scheduled" ? 60 : 12
        });
      }

      if (url.endsWith("/book") && options.method === "POST") {
        return createFetchResponse({
          message: "Instant booking added ✅",
          booking: {
            _id: "walk-in-booking",
            orderId: "walk-in-1",
            chairName: "Chair 1"
          }
        });
      }

      if (url.includes("/bookings")) {
        return createFetchResponse([
          {
            _id: "booking-1",
            barberId: "barber-1",
            customerId: "customer-1",
            customerName: "Aman",
            services: ["Haircut"],
            orderId: "1234",
            totalTime: 15,
            bookingType: "instant",
            startTime: "2026-05-23T10:00:00.000Z",
            status: "booked",
            totalPrice: 100
          },
          {
            _id: "booking-2",
            barberId: "barber-1",
            customerId: "customer-2",
            customerName: "Riya",
            services: ["Wax"],
            serviceItems: [{ name: "Wax", duration: 10, price: 50 }],
            orderId: "5678",
            totalTime: 10,
            bookingType: "instant",
            startTime: "2026-05-23T09:00:00.000Z",
            status: "completed",
            completedAt: "2026-05-23T09:30:00.000Z",
            totalPrice: 50
          },
          {
            _id: "booking-3",
            barberId: "barber-1",
            customerId: "customer-3",
            customerName: "Kabir",
            services: ["Beard"],
            serviceItems: [{ name: "Beard", duration: 20, price: 80 }],
            orderId: "9012",
            totalTime: 20,
            bookingType: "instant",
            startTime: "2026-05-24T08:00:00.000Z",
            status: "cancelled",
            cancelledAt: "2026-05-24T08:20:00.000Z",
            totalPrice: 80
          }
        ]);
      }

      if (url.includes("/customer-profiles/")) {
        return createFetchResponse([
          {
            barberId: "barber-1",
            customerId: "customer-1",
            customerName: "Aman",
            visitCount: 4,
            totalSpend: 400,
            badge: "Regular",
            favoriteServices: [{ name: "Haircut", count: 3 }],
            topService: "Haircut"
          },
          {
            barberId: "barber-1",
            customerId: "customer-2",
            customerName: "Riya",
            visitCount: 1,
            totalSpend: 50,
            badge: "New",
            favoriteServices: [{ name: "Wax", count: 1 }],
            topService: "Wax"
          },
          {
            barberId: "barber-1",
            customerId: "customer-3",
            customerName: "Kabir",
            visitCount: 0,
            totalSpend: 0,
            badge: "New",
            favoriteServices: [],
            topService: null
          }
        ]);
      }

      if (url.includes("/analytics/overview")) {
        const requestUrl = new URL(url);
        const preset = requestUrl.searchParams.get("rangePreset");
        const startDate = requestUrl.searchParams.get("startDate");
        const endDate = requestUrl.searchParams.get("endDate");

        if (preset === "custom" && startDate && endDate) {
          return createFetchResponse(analyticsByPreset.customFilled);
        }

        return createFetchResponse(analyticsByPreset[preset] || analyticsByPreset.today);
      }

      return createFetchResponse({});
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete window.alert;
    localStorage.clear();
  });

  test("shows queue by default and switches sections with nav buttons", async () => {
    render(<BarberDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Per-Chair Live Queue")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByText((_, element) => element?.textContent === "1. Aman")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Regular")).toBeInTheDocument();
    expect(screen.getByText("4 visits")).toBeInTheDocument();
    expect(screen.queryByText("Order History")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Chairs")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Order History")).toBeInTheDocument();
    expect(screen.getByText("Riya")).toBeInTheDocument();
    expect(screen.getByText("Kabir")).toBeInTheDocument();
    expect(screen.getByText("Favorite Service: Wax")).toBeInTheDocument();
    expect(screen.getByText("Total: Rs 50")).toBeInTheDocument();
    expect(screen.getByText("Snapshot: Wax (Rs 50)")).toBeInTheDocument();
    expect(screen.queryByText("1. Aman")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));
    expect(screen.getByText("Manage Chairs")).toBeInTheDocument();
    expect(screen.getByText("Chair Performance")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Busiest Chair")).toBeInTheDocument();
    });
    expect(screen.getByText("Avg Service: 23 min")).toBeInTheDocument();
    expect(screen.getByText("Utilization: 3.1%")).toBeInTheDocument();
    expect(screen.getByText("Idle Time: 1395 min")).toBeInTheDocument();
    expect(screen.queryByText("Order History")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Chair Revenue" }));
    expect(screen.getAllByText("Chair Revenue").length).toBeGreaterThan(0);
    expect(screen.getByText("Per-Chair Revenue")).toBeInTheDocument();
    expect(screen.getByText("Total Chair Revenue")).toBeInTheDocument();
    expect(screen.getByText("Top Earning Chair")).toBeInTheDocument();
    expect(screen.getByText("Avg Booking Value")).toBeInTheDocument();
    expect(screen.getByText("Unassigned Revenue")).toBeInTheDocument();
    expect(screen.getByText("Revenue Attention")).toBeInTheDocument();
    expect(screen.getByText("Total Time Worked")).toBeInTheDocument();
    expect(screen.getByText("Revenue Generated")).toBeInTheDocument();
    expect(screen.getByText("Chair 1 has Rs 150 revenue and 1395 min idle time in this range.")).toBeInTheDocument();
    expect(screen.getByText("Completed: Rs 50")).toBeInTheDocument();
    expect(screen.getByText("Avg Ticket: Rs 75")).toBeInTheDocument();
    expect(screen.getByText("Per Service Hour: Rs 200")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show Transactions" }));
    expect(screen.getByText("Transaction history")).toBeInTheDocument();
    expect(screen.getByText("2026-05-24")).toBeInTheDocument();
    expect(screen.getByText("Riya")).toBeInTheDocument();
    expect(screen.getByText("Aman")).toBeInTheDocument();
    expect(screen.getByText("Order: 5678")).toBeInTheDocument();
    expect(screen.getByText("Order: 1234")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hide Transactions" }));
    expect(screen.queryByText("Transaction history")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Chairs")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Walk-ins" }));
    expect(screen.getByText("Add Walk-in")).toBeInTheDocument();
    expect(screen.queryByText("Manage Chairs")).not.toBeInTheDocument();
  });

  test("loads platform analytics, switches date presets, and waits for a full custom range", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Analytics" }));

    await waitFor(() => {
      expect(screen.getByText("Barber Performance")).toBeInTheDocument();
    });

    expect(screen.getByText("Platform Overview")).toBeInTheDocument();
    expect(screen.getByText("Total Platform Bookings")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Customer Growth")).toBeInTheDocument();
    expect(screen.getByText("New customers in this period")).toBeInTheDocument();
    expect(screen.getByText("Cancellation Rate")).toBeInTheDocument();
    expect(screen.getByText("33.3%")).toBeInTheDocument();
    expect(screen.getByText("Top Performing Shops")).toBeInTheDocument();
    expect(screen.getByText("1. Style Studio")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Myself" }));

    expect(screen.getByText("My Shop Overview")).toBeInTheDocument();
    expect(screen.getByText("My Shop")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getByText("My Bookings")).toBeInTheDocument();
    expect(screen.getByText("Your shop in the selected range")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.queryByText("Top Performing Shops")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Overall" }));
    expect(screen.getByText("Platform Overview")).toBeInTheDocument();
    expect(screen.getByText("Top Performing Shops")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "This Week" }));

    await waitFor(() => {
      expect(screen.getByText("Rs 450")).toBeInTheDocument();
    });
    expect(screen.getByText("12.5%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "This Month" }));

    await waitFor(() => {
      expect(screen.getByText("Rs 980")).toBeInTheDocument();
    });
    expect(screen.getByText("20.0%")).toBeInTheDocument();
    expect(screen.getByText("1. Clip Joint")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Myself" }));
    expect(screen.getByText("10.0%")).toBeInTheDocument();
    expect(screen.queryByText("Top Performing Shops")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Overall" }));

    const analyticsCallsBeforeCustom = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;

    await userEvent.click(screen.getByRole("button", { name: "Custom Range" }));

    expect(screen.getByLabelText("Analytics start date")).toBeInTheDocument();
    expect(screen.getByLabelText("Analytics end date")).toBeInTheDocument();
    expect(screen.getByText("Select both dates to load a custom analytics range.")).toBeInTheDocument();

    const analyticsCallsAfterCustomToggle = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;
    expect(analyticsCallsAfterCustomToggle).toBe(analyticsCallsBeforeCustom);

    fireEvent.change(screen.getByLabelText("Analytics start date"), {
      target: { value: "2026-05-01" }
    });

    const analyticsCallsAfterStartOnly = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;
    expect(analyticsCallsAfterStartOnly).toBe(analyticsCallsBeforeCustom);

    fireEvent.change(screen.getByLabelText("Analytics end date"), {
      target: { value: "2026-05-02" }
    });

    await waitFor(() => {
      expect(screen.getByText("No service data yet.")).toBeInTheDocument();
    });
    expect(screen.getByText("No shop performance data yet.")).toBeInTheDocument();
    expect(screen.getAllByText("0")[0]).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  test("reuses the shared date filters in the Chairs tab and renders the zero-activity state", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));

    await waitFor(() => {
      expect(screen.getByText("Busiest Chair")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Chair 1").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Custom Range" }));
    expect(screen.getByText("Select both dates to load a custom analytics range.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Analytics start date"), {
      target: { value: "2026-05-01" }
    });
    fireEvent.change(screen.getByLabelText("Analytics end date"), {
      target: { value: "2026-05-02" }
    });

    await waitFor(() => {
      expect(screen.getByText("No chair activity in this range.")).toBeInTheDocument();
    });
    expect(screen.getByText("No chair activity")).toBeInTheDocument();
    expect(screen.getByText("0 bookings in this range")).toBeInTheDocument();
  });

  test("shows a friendly analytics error when analytics loading fails", async () => {
    const defaultFetch = global.fetch;
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/analytics/overview")) {
        return createErrorResponse({ error: "Analytics offline", message: "Analytics offline" }, 500);
      }

      return defaultFetch(url, options);
    });

    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Analytics" }));

    await waitFor(() => {
      expect(screen.getByText("Analytics offline")).toBeInTheDocument();
    });
  });

  test("reuses shared date filters in the Chair Revenue tab and renders zero revenue state", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chair Revenue" }));

    await waitFor(() => {
      expect(screen.getByText("Per-Chair Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText("Total Chair Revenue")).toBeInTheDocument();
    expect(screen.getAllByText("Rs 150").length).toBeGreaterThan(0);
    expect(screen.getByText("Revenue Attention")).toBeInTheDocument();

    const analyticsCallsBeforeCustom = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;

    await userEvent.click(screen.getByRole("button", { name: "Custom Range" }));
    expect(screen.getByText("Select both dates to load a custom analytics range.")).toBeInTheDocument();

    const analyticsCallsAfterCustomToggle = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;
    expect(analyticsCallsAfterCustomToggle).toBe(analyticsCallsBeforeCustom);

    fireEvent.change(screen.getByLabelText("Analytics start date"), {
      target: { value: "2026-05-01" }
    });
    fireEvent.change(screen.getByLabelText("Analytics end date"), {
      target: { value: "2026-05-02" }
    });

    await waitFor(() => {
      expect(screen.getByText("Avg Ticket: Rs 0")).toBeInTheDocument();
    });
    expect(screen.getAllByText("No chair revenue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rs 0").length).toBeGreaterThan(0);
    expect(screen.getByText("Per Service Hour: Rs 0")).toBeInTheDocument();
  });

  test("shows a monthly chair revenue summary table with day columns and a total row", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chair Revenue" }));
    await waitFor(() => {
      expect(screen.getByText("Per-Chair Revenue")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Month Summary" }));

    await waitFor(() => {
      expect(screen.getByText("Monthly Chair Revenue Summary")).toBeInTheDocument();
    });

    expect(screen.getByText("Chair")).toBeInTheDocument();
    expect(screen.getByText("Daily Ledger")).toBeInTheDocument();
    expect(screen.getByText("May 2026 daily chair revenue with row totals and a bottom rollup.")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("31").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
    expect(screen.getByText("Chair 1")).toBeInTheDocument();
    expect(screen.getByText("All Chairs")).toBeInTheDocument();
    expect(screen.getByText("Grand Total")).toBeInTheDocument();
    expect(screen.getAllByText("Rs 300").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rs 680").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rs 980").length).toBeGreaterThan(0);
  });

  test("persists added and deleted chairs from the Chairs tab", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Chair 1")).toBeInTheDocument();
    });
    const analyticsCallsBeforeAdd = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;

    await userEvent.click(screen.getByRole("button", { name: "Add Chair" }));

    await waitFor(() => {
      const chairPutCalls = global.fetch.mock.calls.filter(
        ([url, options]) => url.includes("/chairs/") && options?.method === "PUT"
      );
      expect(chairPutCalls).toHaveLength(1);
      expect(JSON.parse(chairPutCalls[0][1].body).chairs).toEqual([
        { id: "chair-1", name: "Chair 1", isActive: true },
        expect.objectContaining({ name: "Chair 2", isActive: true })
      ]);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Chair 2")).toBeInTheDocument();
    });
    await waitFor(() => {
      const analyticsCallsAfterAdd = global.fetch.mock.calls.filter(([url]) =>
        url.includes("/analytics/overview")
      ).length;
      expect(analyticsCallsAfterAdd).toBeGreaterThan(analyticsCallsBeforeAdd);
    });

    const analyticsCallsBeforeDelete = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/analytics/overview")
    ).length;

    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);

    await waitFor(() => {
      const chairPutCalls = global.fetch.mock.calls.filter(
        ([url, options]) => url.includes("/chairs/") && options?.method === "PUT"
      );
      expect(chairPutCalls).toHaveLength(2);
      expect(JSON.parse(chairPutCalls[1][1].body).chairs).toEqual([
        { id: "chair-1", name: "Chair 1", isActive: true }
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Chair 2")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      const analyticsCallsAfterDelete = global.fetch.mock.calls.filter(([url]) =>
        url.includes("/analytics/overview")
      ).length;
      expect(analyticsCallsAfterDelete).toBeGreaterThan(analyticsCallsBeforeDelete);
    });
  });

  test("shows a friendly chair save error when persistence fails", async () => {
    const defaultFetch = global.fetch;
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/chairs/") && options?.method === "PUT") {
        return createErrorResponse({ error: "Invalid chair payload", message: "Chair save failed" }, 400);
      }

      return defaultFetch(url, options);
    });

    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Chair 1")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Add Chair" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Chair save failed");
    });
    expect(screen.getByText("Chair save failed")).toBeInTheDocument();
  });

  test("prevents deleting the last active chair while the shop is open", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Chair 1")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.alert).toHaveBeenCalledWith("Keep at least one chair active while the shop is open");
    const chairPutCalls = global.fetch.mock.calls.filter(
      ([url, options]) => url.includes("/chairs/") && options?.method === "PUT"
    );
    expect(chairPutCalls).toHaveLength(0);
    expect(screen.getByDisplayValue("Chair 1")).toBeInTheDocument();
  });

  test("closing the shop turns all chairs off and reopening restores the previously active chairs", async () => {
    mockChairs = [
      { id: "chair-1", name: "Chair 1", isActive: true },
      { id: "chair-2", name: "Chair 2", isActive: false }
    ];

    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Chair 1")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Chair 2")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Close Shop" }));

    await waitFor(() => {
      expect(screen.getAllByText("Inactive").length).toBeGreaterThanOrEqual(2);
    });

    await userEvent.click(screen.getByRole("button", { name: "Open Shop" }));

    await waitFor(() => {
      expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Inactive").length).toBeGreaterThanOrEqual(1);
    });
  });

  test("previews expected start for barber walk-ins before adding them to the queue", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "Walk-ins" }));
    await waitFor(() => {
      expect(screen.getByText("Add Walk-in")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText("Customer Name"), "Dev");
    await userEvent.click(screen.getAllByRole("button", { name: "Select" })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Expected start:/)).toBeInTheDocument();
    });
    expect(
      screen.getByText((_, element) => element?.textContent === "Waiting: 12 min")
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Chair: Chair 1")
    ).toBeInTheDocument();

    const instantEstimateCalls = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/estimate-booking")
    );
    expect(instantEstimateCalls).toHaveLength(1);
    expect(JSON.parse(instantEstimateCalls[0][1].body)).toEqual({
      barberId: "barber-1",
      totalTime: 15,
      bookingType: "instant",
      scheduledFor: null
    });

    await userEvent.click(screen.getByLabelText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Select scheduled time to see expected start")).toBeInTheDocument();
    });
    expect(
      global.fetch.mock.calls.filter(([url]) => url.includes("/estimate-booking"))
    ).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Scheduled For"), {
      target: { value: "2026-05-24T18:30" }
    });

    await waitFor(() => {
      expect(
        screen.getByText((_, element) => element?.textContent === "Waiting: 60 min")
      ).toBeInTheDocument();
    });

    const scheduledEstimateCalls = global.fetch.mock.calls.filter(([url]) =>
      url.includes("/estimate-booking")
    );
    expect(scheduledEstimateCalls).toHaveLength(2);
    expect(JSON.parse(scheduledEstimateCalls[1][1].body)).toEqual({
      barberId: "barber-1",
      totalTime: 15,
      bookingType: "scheduled",
      scheduledFor: "2026-05-24T18:30"
    });

    await userEvent.click(screen.getByRole("button", { name: "Add to Queue" }));

    await waitFor(() => {
      const bookingCalls = global.fetch.mock.calls.filter(
        ([url, options]) => url.endsWith("/book") && options?.method === "POST"
      );
      expect(bookingCalls).toHaveLength(1);
      expect(JSON.parse(bookingCalls[0][1].body)).toEqual(
        expect.objectContaining({
          barberId: "barber-1",
          services: ["Haircut"],
          totalTime: 15,
          customerName: "Dev",
          isOffline: true,
          bookingType: "scheduled",
          scheduledFor: "2026-05-24T18:30"
        })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(/Expected start:/)).not.toBeInTheDocument();
    });
  });

  test("filters barber history by customer, service, token, status, and date", async () => {
    render(<BarberDashboard />);

    await userEvent.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("Riya")).toBeInTheDocument();
    });
    expect(screen.getByText("Kabir")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Barber history search"), "kabir");
    expect(screen.getByText("Kabir")).toBeInTheDocument();
    expect(screen.queryByText("Riya")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Barber history search"));
    await userEvent.type(screen.getByLabelText("Barber history search"), "wax");
    expect(screen.getByText("Riya")).toBeInTheDocument();
    expect(screen.queryByText("Kabir")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Barber history search"));
    await userEvent.type(screen.getByLabelText("Barber history search"), "9012");
    expect(screen.getByText("Kabir")).toBeInTheDocument();
    expect(screen.queryByText("Riya")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Barber history search"));
    await userEvent.selectOptions(screen.getByLabelText("Barber history status"), "completed");
    expect(screen.getByText("Riya")).toBeInTheDocument();
    expect(screen.queryByText("Kabir")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Barber history start date"), {
      target: { value: "2026-05-24" }
    });
    fireEvent.change(screen.getByLabelText("Barber history end date"), {
      target: { value: "2026-05-24" }
    });
    expect(screen.getByText("No history results match the current filters.")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Barber history status"), "cancelled");
    expect(screen.getByText("Kabir")).toBeInTheDocument();
    expect(screen.queryByText("Riya")).not.toBeInTheDocument();
  });
});
