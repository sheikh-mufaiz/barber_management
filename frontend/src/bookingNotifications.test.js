import {
  detectBookingNotifications,
  formatNotificationToken
} from "./bookingNotifications";

const baseBooking = {
  _id: "booking-1",
  barberId: "barber-1",
  customerId: "customer-1",
  customerName: "Aman",
  chairName: "Chair 1",
  orderId: "1779523539770",
  totalTime: 20,
  status: "booked",
  startTime: "2026-05-23T10:30:00.000Z",
  actualStartTime: null
};

describe("booking notification helpers", () => {
  test("formats notification tokens from order ids", () => {
    expect(formatNotificationToken("1779523539770")).toBe("Token #9770");
    expect(formatNotificationToken("12")).toBe("Token #12");
    expect(formatNotificationToken("")).toBe("Token pending");
  });

  test("creates customer notifications for near turn, service start, completion, and schedule change", () => {
    const now = new Date("2026-05-23T10:00:00.000Z").getTime();

    const previousBookings = [
      {
        ...baseBooking,
        startTime: "2026-05-23T10:20:00.000Z"
      }
    ];

    const currentBookings = [
      {
        ...baseBooking,
        startTime: "2026-05-23T10:08:00.000Z"
      }
    ];

    const nearTurnNotifications = detectBookingNotifications({
      previousBookings,
      currentBookings,
      viewerRole: "customer",
      viewerUserId: "customer-1",
      nearTurnThreshold: 10,
      now
    });

    expect(nearTurnNotifications.map((notification) => notification.title)).toEqual([
      "Schedule Changed",
      "Your Turn Is Near"
    ]);

    const startedNotifications = detectBookingNotifications({
      previousBookings: [{ ...baseBooking, startTime: "2026-05-23T10:08:00.000Z" }],
      currentBookings: [
        {
          ...baseBooking,
          status: "in-progress",
          startTime: "2026-05-23T10:08:00.000Z",
          actualStartTime: "2026-05-23T10:08:00.000Z"
        }
      ],
      viewerRole: "customer",
      viewerUserId: "customer-1",
      now
    });

    expect(startedNotifications[0]).toMatchObject({
      title: "Service Started",
      variant: "info"
    });

    const completedNotifications = detectBookingNotifications({
      previousBookings: [
        {
          ...baseBooking,
          status: "in-progress",
          actualStartTime: "2026-05-23T10:08:00.000Z"
        }
      ],
      currentBookings: [
        {
          ...baseBooking,
          status: "completed",
          actualStartTime: "2026-05-23T10:08:00.000Z"
        }
      ],
      viewerRole: "customer",
      viewerUserId: "customer-1",
      now
    });

    expect(completedNotifications[0]).toMatchObject({
      title: "Booking Completed",
      variant: "success"
    });
  });

  test("creates barber notifications for new bookings and queue shifts", () => {
    const newBookingNotifications = detectBookingNotifications({
      previousBookings: [],
      currentBookings: [baseBooking],
      viewerRole: "barber",
      viewerUserId: "barber-1",
      now: new Date("2026-05-23T10:00:00.000Z").getTime()
    });

    expect(newBookingNotifications[0]).toMatchObject({
      title: "Booking Confirmed",
      variant: "success"
    });

    const shiftNotifications = detectBookingNotifications({
      previousBookings: [baseBooking],
      currentBookings: [
        {
          ...baseBooking,
          startTime: "2026-05-23T10:40:00.000Z"
        }
      ],
      viewerRole: "barber",
      viewerUserId: "barber-1",
      now: new Date("2026-05-23T10:00:00.000Z").getTime()
    });

    expect(shiftNotifications[0]).toMatchObject({
      title: "Schedule Changed",
      variant: "update"
    });
  });

  test("does not create notifications when polling data is unchanged", () => {
    const notifications = detectBookingNotifications({
      previousBookings: [baseBooking],
      currentBookings: [baseBooking],
      viewerRole: "customer",
      viewerUserId: "customer-1",
      now: new Date("2026-05-23T10:00:00.000Z").getTime()
    });

    expect(notifications).toEqual([]);
  });
});
