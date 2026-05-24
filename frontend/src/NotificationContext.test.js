import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationProvider, useNotifications } from "./NotificationContext";

function NotificationHarness() {
  const { notify } = useNotifications();

  return (
    <button
      type="button"
      onClick={() =>
        notify({
          title: "Service Started",
          message: "Token #1234 is now in the chair.",
          variant: "info",
          duration: 1000
        })
      }
    >
      Trigger Notification
    </button>
  );
}

describe("NotificationProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("renders toast notifications and auto-dismisses them", async () => {
    render(
      <NotificationProvider>
        <NotificationHarness />
      </NotificationProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Trigger Notification" }));

    expect(screen.getByText("Service Started")).toBeInTheDocument();
    expect(screen.getByText("Token #1234 is now in the chair.")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByText("Service Started")).not.toBeInTheDocument();
  });

  test("allows notifications to be dismissed manually", async () => {
    render(
      <NotificationProvider>
        <NotificationHarness />
      </NotificationProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Trigger Notification" }));
    await userEvent.click(screen.getByRole("button", { name: /dismiss service started/i }));

    expect(screen.queryByText("Service Started")).not.toBeInTheDocument();
  });
});
