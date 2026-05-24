import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.queryByText("1. Aman")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Chairs" }));
    expect(screen.getByText("Manage Chairs")).toBeInTheDocument();
    expect(screen.queryByText("Order History")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Walk-ins" }));
    expect(screen.getByText("Add Walk-in")).toBeInTheDocument();
    expect(screen.queryByText("Manage Chairs")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Analytics" }));
    expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Total Bookings")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Estimated Revenue")).toBeInTheDocument();
    expect(screen.getByText("Rs 150")).toBeInTheDocument();
    expect(screen.getByText("Most Popular Service")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Peak Booking Hours")).toBeInTheDocument();
    expect(screen.queryByText("Add Walk-in")).not.toBeInTheDocument();
  });
});
