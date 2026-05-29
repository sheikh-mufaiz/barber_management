import { apiFetch } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("adds the stored token and clears the session on 401", async () => {
    const expiredListener = jest.fn();
    localStorage.setItem("token", "token-123");
    localStorage.setItem("user", JSON.stringify({ _id: "customer-1", role: "customer" }));
    window.addEventListener("auth:expired", expiredListener);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 401,
        json: async () => ({ error: "Authentication required" })
      })
    );

    await apiFetch("/bookings");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/bookings",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-123" }
      })
    );
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(expiredListener).toHaveBeenCalled();

    window.removeEventListener("auth:expired", expiredListener);
  });
});
