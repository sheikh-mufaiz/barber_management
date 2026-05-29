import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Booking from "./Booking";

jest.mock("./ShopList", () => function ShopListMock({ setSelectedBarber }) {
  return (
    <button
      type="button"
      onClick={() =>
        setSelectedBarber({
          _id: "barber-1",
          shopName: "Style Studio"
        })
      }
    >
      Select Style Studio
    </button>
  );
});

jest.mock("./QueueBoard", () => function QueueBoardMock({ title }) {
  return <div>{title}</div>;
});

jest.mock("./NotificationContext", () => ({
  useNotifications: () => ({
    notify: jest.fn()
  })
}));

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

describe("Booking customer navigation", () => {
  beforeEach(() => {
    localStorage.setItem(
      "user",
      JSON.stringify({
        _id: "customer-1",
        name: "Aman",
        role: "customer"
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
        return createFetchResponse([
          { id: "chair-1", name: "Chair 1", isActive: true }
        ]);
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
            startTime: "2026-05-24T10:00:00.000Z",
            status: "booked",
            chairName: "Chair 1"
          },
          {
            _id: "booking-2",
            barberId: "barber-1",
            customerId: "customer-1",
            customerName: "Aman",
            services: ["Wax"],
            serviceItems: [{ name: "Wax", duration: 10, price: 50 }],
            totalPrice: 50,
            orderId: "5678",
            totalTime: 10,
            bookingType: "instant",
            startTime: "2026-05-24T09:00:00.000Z",
            status: "completed",
            chairName: "Chair 1",
            completedAt: "2026-05-24T09:30:00.000Z"
          },
          {
            _id: "booking-3",
            barberId: "barber-1",
            customerId: "customer-1",
            customerName: "Aman",
            services: ["Haircut"],
            serviceItems: [{ name: "Haircut", duration: 15, price: 100 }],
            totalPrice: 100,
            orderId: "9012",
            totalTime: 15,
            bookingType: "instant",
            startTime: "2026-05-23T11:00:00.000Z",
            status: "cancelled",
            chairName: "Chair 1",
            cancelledAt: "2026-05-23T11:20:00.000Z"
          }
        ]);
      }

      if (url.includes("/customer-profile/")) {
        return createFetchResponse({
          barberId: "barber-1",
          customerId: "customer-1",
          customerName: "Aman",
          visitCount: 3,
          totalSpend: 300,
          badge: "Regular",
          favoriteServices: [{ name: "Haircut", count: 2 }],
          topService: "Haircut",
          recentBookings: [
            {
              _id: "recent-1",
              orderId: "5678",
              services: ["Wax"],
              totalPrice: 50,
              status: "completed",
              completedAt: "2026-05-24T09:30:00.000Z",
              createdAt: "2026-05-24T09:00:00.000Z",
              updatedAt: "2026-05-24T09:30:00.000Z"
            }
          ]
        });
      }

      if (url.includes("/cancel/")) {
        return createFetchResponse({ message: "Cancelled" });
      }

      if (url.includes("/estimate-booking")) {
        return createFetchResponse({
          available: true,
          estimatedStartTime: "2026-05-24T10:00:00.000Z",
          waitMinutes: 0,
          chairName: "Chair 1"
        });
      }

      return createFetchResponse({});
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("shows customer nav sections after shop selection and switches views", async () => {
    render(<Booking />);

    expect(screen.getByText("Select Style Studio")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Select Style Studio" }));

    await waitFor(() => {
      expect(screen.getAllByText("Style Studio").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("button", { name: "Book" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();

    expect(screen.getByText("Select Services")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book Selected Services" })).toBeInTheDocument();
    expect(screen.queryByText("Current Queue")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Queue" }));
    expect(screen.getByText("Current Queue")).toBeInTheDocument();
    expect(screen.queryByText("Book Selected Services")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByText("Your Active Bookings")).toBeInTheDocument();
    expect(screen.getByText("Order: 1234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByText("Current Queue")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Order History")).toBeInTheDocument();
    expect(screen.getByText("Order: 5678")).toBeInTheDocument();
    expect(screen.getByText("Order: 9012")).toBeInTheDocument();
    expect(screen.getByText("Total: Rs 50")).toBeInTheDocument();
    expect(screen.getAllByText("Snapshot: Wax (Rs 50)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Your Active Bookings")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Profile" }));
    await waitFor(() => {
      expect(screen.getByText("Your Loyalty Profile")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Regular").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rs 300").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Haircut").length).toBeGreaterThan(0);
    expect(screen.queryByText("Your Active Bookings")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Change Shop" }));
    expect(screen.getByText("Select Style Studio")).toBeInTheDocument();
    expect(screen.queryByText("Style Studio")).not.toBeInTheDocument();
  });

  test("does not show the active-booking confirm when only history exists", async () => {
    window.confirm = jest.fn();

    global.fetch = jest.fn((url) => {
      if (url.includes("/services/")) {
        return createFetchResponse([
          { _id: "svc-1", name: "Haircut", duration: 15, price: 100 }
        ]);
      }

      if (url.includes("/chairs/")) {
        return createFetchResponse([
          { id: "chair-1", name: "Chair 1", isActive: true }
        ]);
      }

      if (url.includes("/bookings")) {
        return createFetchResponse([
          {
            _id: "booking-history-only",
            barberId: "barber-1",
            customerId: "customer-1",
            customerName: "Aman",
            services: ["Haircut"],
            orderId: "9999",
            totalTime: 15,
            bookingType: "instant",
            startTime: "2026-05-24T09:00:00.000Z",
            status: "completed",
            chairName: "Chair 1",
            completedAt: "2026-05-24T09:30:00.000Z"
          }
        ]);
      }

      if (url.includes("/customer-profile/")) {
        return createFetchResponse({
          barberId: "barber-1",
          customerId: "customer-1",
          customerName: "Aman",
          visitCount: 0,
          totalSpend: 0,
          badge: "New",
          favoriteServices: [],
          topService: null,
          recentBookings: []
        });
      }

      if (url.includes("/estimate-booking")) {
        return createFetchResponse({
          available: true,
          estimatedStartTime: "2026-05-24T10:00:00.000Z",
          waitMinutes: 0,
          chairName: "Chair 1"
        });
      }

      if (url.includes("/book")) {
        return createFetchResponse({
          message: "Instant booking added ✅",
          booking: {
            orderId: "1010",
            chairName: "Chair 1"
          }
        });
      }

      return createFetchResponse({});
    });

    render(<Booking />);

    await userEvent.click(screen.getByRole("button", { name: "Select Style Studio" }));

    await waitFor(() => {
      expect(screen.getAllByText("Style Studio").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getByText("Haircut")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Haircut"));
    await waitFor(() => {
      expect(screen.getByText(/Expected start:/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Book Selected Services" }));
    await waitFor(() => {
      expect(screen.getByText("Instant booking added ✅")).toBeInTheDocument();
    });

    expect(window.confirm).not.toHaveBeenCalled();
  });

  test("filters customer history by search, status, and date range", async () => {
    render(<Booking />);

    await userEvent.click(screen.getByRole("button", { name: "Select Style Studio" }));

    await waitFor(() => {
      expect(screen.getAllByText("Style Studio").length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getByRole("button", { name: "History" }));

    expect(screen.getByText("Order: 5678")).toBeInTheDocument();
    expect(screen.getByText("Order: 9012")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Customer history search"), "wax");
    expect(screen.getByText("Order: 5678")).toBeInTheDocument();
    expect(screen.queryByText("Order: 9012")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Customer history search"));
    await userEvent.type(screen.getByLabelText("Customer history search"), "9012");
    expect(screen.getByText("Order: 9012")).toBeInTheDocument();
    expect(screen.queryByText("Order: 5678")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Customer history search"));
    await userEvent.selectOptions(screen.getByLabelText("Customer history status"), "cancelled");
    expect(screen.getByText("Order: 9012")).toBeInTheDocument();
    expect(screen.queryByText("Order: 5678")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Customer history start date"), {
      target: { value: "2026-05-24" }
    });
    fireEvent.change(screen.getByLabelText("Customer history end date"), {
      target: { value: "2026-05-24" }
    });
    expect(screen.getByText("No history results match the current filters.")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Customer history status"), "completed");
    expect(screen.getByText("Order: 5678")).toBeInTheDocument();
    expect(screen.queryByText("Order: 9012")).not.toBeInTheDocument();
  });

  test("shows a friendly error when booking estimate fails", async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes("/services/")) {
        return createFetchResponse([
          { _id: "svc-1", name: "Haircut", duration: 15, price: 100 }
        ]);
      }

      if (url.includes("/chairs/")) {
        return createFetchResponse([{ id: "chair-1", name: "Chair 1", isActive: true }]);
      }

      if (url.includes("/bookings")) {
        return createFetchResponse([]);
      }

      if (url.includes("/customer-profile/")) {
        return createFetchResponse({
          barberId: "barber-1",
          customerId: "customer-1",
          customerName: "Aman",
          visitCount: 0,
          totalSpend: 0,
          badge: "New",
          favoriteServices: [],
          topService: null,
          recentBookings: []
        });
      }

      if (url.includes("/estimate-booking")) {
        return createErrorResponse({
          available: false,
          message: "No active chairs available right now"
        }, 409);
      }

      return createFetchResponse({});
    });

    render(<Booking />);

    await userEvent.click(screen.getByRole("button", { name: "Select Style Studio" }));
    await waitFor(() => {
      expect(screen.getByText("Haircut")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Haircut"));

    await waitFor(() => {
      expect(screen.getByText("No active chairs available right now")).toBeInTheDocument();
    });
  });
});
