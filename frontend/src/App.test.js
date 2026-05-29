import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login screen by default", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  expect(screen.getByText(/sign in to your workspace/i)).toBeInTheDocument();
});
