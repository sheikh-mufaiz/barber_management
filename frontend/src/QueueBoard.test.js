import { render, screen, within } from "@testing-library/react";
import QueueBoard from "./QueueBoard";

const chairs = [
  { id: "chair-1", name: "Chair 1", isActive: true },
  { id: "chair-2", name: "Chair 2", isActive: true }
];

const baseNow = "2026-05-23T10:00:00.000Z";

const formatExpectedLabel = (value) =>
  `Expected: ${new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })}`;

const makeBooking = (overrides) => ({
  _id: `booking-${Math.random()}`,
  orderId: "1012",
  customerName: "Customer",
  chairId: "chair-1",
  chairName: "Chair 1",
  totalTime: 30,
  startTime: "2026-05-23T10:00:00.000Z",
  actualStartTime: null,
  status: "booked",
  createdAt: "2026-05-23T09:55:00.000Z",
  ...overrides
});

describe("QueueBoard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(baseNow));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders separate queue cards for multiple chairs", () => {
    render(<QueueBoard chairs={chairs} bookings={[]} title="Current Queue" />);

    expect(screen.getByText("Chair 1")).toBeInTheDocument();
    expect(screen.getByText("Chair 2")).toBeInTheDocument();
    expect(screen.getAllByText("Chair Available")).toHaveLength(2);
  });

  test("shows the in-progress booking as now serving for its chair", () => {
    render(
      <QueueBoard
        chairs={chairs}
        bookings={[
          makeBooking({
            _id: "in-progress",
            orderId: "9912",
            customerName: "Aman",
            status: "in-progress",
            actualStartTime: "2026-05-23T09:50:00.000Z"
          })
        ]}
      />
    );

    const card = screen.getByText("Chair 1").closest("article");

    expect(within(card).getByText("Now Serving")).toBeInTheDocument();
    expect(within(card).getAllByText("Token #9912").length).toBeGreaterThan(0);
    expect(within(card).getByText("Aman")).toBeInTheDocument();
    expect(within(card).getByText("20 mins left")).toBeInTheDocument();
  });

  test("shows ready-next state and waiting customers for a future-only chair", () => {
    render(
      <QueueBoard
        chairs={chairs}
        bookings={[
          makeBooking({
            _id: "ready-booking",
            orderId: "1013",
            customerName: "Riya",
            chairId: "chair-2",
            chairName: "Chair 2",
            startTime: "2026-05-23T10:00:00.000Z"
          }),
          makeBooking({
            _id: "next-booking",
            orderId: "1014",
            customerName: "Kabir",
            chairId: "chair-2",
            chairName: "Chair 2",
            startTime: "2026-05-23T10:18:00.000Z"
          })
        ]}
      />
    );

    const card = screen.getByText("Chair 2").closest("article");

    expect(within(card).getByText("Ready Next")).toBeInTheDocument();
    expect(within(card).getAllByText("Token #1013").length).toBeGreaterThan(0);
    expect(within(card).getByText("Ready to start")).toBeInTheDocument();
    expect(within(card).getByText("Token #1014")).toBeInTheDocument();
    expect(within(card).getByText(formatExpectedLabel("2026-05-23T10:18:00.000Z"))).toBeInTheDocument();
    expect(within(card).getAllByText("18 mins").length).toBeGreaterThan(0);
  });

  test("pushes the displayed expected start when the current service started late", () => {
    render(
      <QueueBoard
        chairs={chairs}
        bookings={[
          makeBooking({
            _id: "live-chair-1",
            orderId: "2001",
            customerName: "Late Start",
            status: "in-progress",
            startTime: "2026-05-23T09:55:00.000Z",
            endTime: "2026-05-23T10:15:00.000Z",
            actualStartTime: "2026-05-23T10:00:00.000Z",
            totalTime: 20
          }),
          makeBooking({
            _id: "next-chair-1",
            orderId: "2002",
            customerName: "Waiting 1",
            startTime: "2026-05-23T10:15:00.000Z"
          })
        ]}
      />
    );

    const card = screen.getByText("Chair 1").closest("article");

    expect(within(card).getByText(formatExpectedLabel("2026-05-23T10:20:00.000Z"))).toBeInTheDocument();
    expect(within(card).getAllByText("20 mins").length).toBeGreaterThan(0);
  });

  test("keeps shifting expected start times when the current service runs over", () => {
    jest.setSystemTime(new Date("2026-05-23T10:22:00.000Z"));

    render(
      <QueueBoard
        chairs={chairs}
        bookings={[
          makeBooking({
            _id: "live-chair-1",
            orderId: "3001",
            customerName: "Overrun",
            status: "in-progress",
            startTime: "2026-05-23T10:00:00.000Z",
            endTime: "2026-05-23T10:20:00.000Z",
            actualStartTime: "2026-05-23T10:00:00.000Z",
            totalTime: 20
          }),
          makeBooking({
            _id: "next-chair-1",
            orderId: "3002",
            customerName: "Waiting 2",
            startTime: "2026-05-23T10:25:00.000Z"
          })
        ]}
      />
    );

    const card = screen.getByText("Chair 1").closest("article");

    expect(within(card).getByText("Running 2 mins over")).toBeInTheDocument();
    expect(within(card).getByText(formatExpectedLabel("2026-05-23T10:27:00.000Z"))).toBeInTheDocument();
    expect(within(card).getAllByText("5 mins").length).toBeGreaterThan(0);
  });

  test("does not shift customers on other chairs when one chair is delayed", () => {
    render(
      <QueueBoard
        chairs={chairs}
        bookings={[
          makeBooking({
            _id: "live-chair-1",
            orderId: "4001",
            customerName: "Delayed",
            status: "in-progress",
            startTime: "2026-05-23T09:55:00.000Z",
            endTime: "2026-05-23T10:15:00.000Z",
            actualStartTime: "2026-05-23T10:00:00.000Z",
            totalTime: 20
          }),
          makeBooking({
            _id: "next-chair-1",
            orderId: "4002",
            customerName: "Chair 1 Next",
            startTime: "2026-05-23T10:15:00.000Z"
          }),
          makeBooking({
            _id: "next-chair-2",
            orderId: "4003",
            customerName: "Chair 2 Next",
            chairId: "chair-2",
            chairName: "Chair 2",
            startTime: "2026-05-23T10:30:00.000Z"
          })
        ]}
      />
    );

    const card = screen.getByText("Chair 2").closest("article");

    expect(within(card).getByText(formatExpectedLabel("2026-05-23T10:30:00.000Z"))).toBeInTheDocument();
    expect(within(card).getAllByText("30 mins").length).toBeGreaterThan(0);
  });

  test("renders an empty state when there are no active chairs", () => {
    render(
      <QueueBoard
        chairs={[{ id: "chair-3", name: "Chair 3", isActive: false }]}
        bookings={[]}
      />
    );

    expect(screen.getByText("No active chairs yet")).toBeInTheDocument();
    expect(
      screen.getByText("Turn on a chair to start showing the real-time queue.")
    ).toBeInTheDocument();
  });

  test("creates an unassigned bucket when a booking has no chair", () => {
    render(
      <QueueBoard
        chairs={chairs}
        bookings={[
          makeBooking({
            _id: "unassigned-booking",
            orderId: "2020",
            chairId: "",
            chairName: ""
          })
        ]}
      />
    );

    const card = screen.getByText("Unassigned").closest("article");

    expect(within(card).getAllByText("Token #2020").length).toBeGreaterThan(0);
    expect(within(card).getByText("Estimated Wait")).toBeInTheDocument();
  });
});
