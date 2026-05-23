import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login screen by default", () => {
  render(<App />);
  expect(screen.getByText(/go to register/i)).toBeInTheDocument();
});
