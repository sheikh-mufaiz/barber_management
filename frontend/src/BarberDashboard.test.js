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
    chairMetrics: {
      summary: {
        busiestChairId: "chair-1",
        busiestChairName: "Chair 1",
        busiestChairBookings: 2
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 2,
          totalServiceMinutes: 45,
          averageServiceMinutes: 22.5,
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
    chairMetrics: {
      summary: {
        busiestChairId: "chair-1",
        busiestChairName: "Chair 1",
        busiestChairBookings: 4
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 4,
          totalServiceMinutes: 90,
          averageServiceMinutes: 22.5,
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
    chairMetrics: {
      summary: {
        busiestChairId: "chair-2",
        busiestChairName: "Chair 2",
        busiestChairBookings: 6
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 3,
          totalServiceMinutes: 60,
          averageServiceMinutes: 20,
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
    chairMetrics: {
      summary: {
        busiestChairId: null,
        busiestChairName: "No chair activity",
        busiestChairBookings: 0
      },
      perChair: [
        {
          chairId: "chair-1",
          chairName: "Chair 1",
          isActive: true,
          bookingCount: 0,
          totalServiceMinutes: 0,
          averageServiceMinutes: 0,
          utilizationRate: 0,
          idleMinutes: 2880
        }
      ]
    },
    topPerformingShops: []
  })
};

describe("BarberDashboard navigation", () => {
  beforeEach(() => {
    localStorage.setItem(
      "user",
      JSON.stringify({
        _id: "barber-1",
        name: "Barber One",
        role: "barber",
        isOpen: true
      })
    );

    global.fetch = jest.fn((url) => {
      if (url.includes("/services/")) {
        return createFetchResponse([
          { _id: "svc-1", name: "Haircut", duration: 15, price: 100 },
          { _id: "svc-2", name: "Wax", duration: 10, price: 50 }
        ]);
      }

      if (url.includes("/chairs/")) {
        return createFetchResponse([{ id: "chair-1", name: "Chair 1", isActive: true }]);
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
});
