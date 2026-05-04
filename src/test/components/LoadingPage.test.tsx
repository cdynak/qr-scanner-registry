import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LoadingPage from "../../components/LoadingPage";

// Mock LoadingSpinner component
vi.mock("../../components/LoadingSpinner", () => ({
  default: ({ size }: { size?: string }) => (
    <div data-testid="loading-spinner" data-size={size}>
      Spinner
    </div>
  ),
}));

describe("LoadingPage", () => {
  it("renders with default message", () => {
    render(<LoadingPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders with custom message", () => {
    render(<LoadingPage message="Please wait while we load your data..." />);

    expect(screen.getByText("Please wait while we load your data...")).toBeInTheDocument();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders LoadingSpinner with large size", () => {
    render(<LoadingPage />);

    const spinner = screen.getByTestId("loading-spinner");
    expect(spinner).toHaveAttribute("data-size", "lg");
  });

  it("applies default classes for full-page layout", () => {
    const { container } = render(<LoadingPage />);

    expect(container.firstChild).toHaveClass("min-h-screen", "flex", "items-center", "justify-center", "bg-background");
  });

  it("applies custom className", () => {
    const { container } = render(<LoadingPage className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("combines custom className with default classes", () => {
    const { container } = render(<LoadingPage className="custom-class" />);

    expect(container.firstChild).toHaveClass(
      "min-h-screen",
      "flex",
      "items-center",
      "justify-center",
      "bg-background",
      "custom-class"
    );
  });

  it("has proper structure for centering content", () => {
    render(<LoadingPage message="Loading content..." />);

    const container = screen.getByText("Loading content...").parentElement;
    expect(container).toHaveClass("text-center", "space-y-4");

    expect(screen.getByText("Loading content...")).toHaveClass("text-muted-foreground");
  });

  it("renders both spinner and message", () => {
    render(<LoadingPage message="Custom loading message" />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.getByText("Custom loading message")).toBeInTheDocument();
  });

  it("has proper accessibility structure", () => {
    render(<LoadingPage message="Loading application..." />);

    // The message should be visible to screen readers
    expect(screen.getByText("Loading application...")).toBeInTheDocument();

    // The container should take full height for proper centering
    const container = screen.getByText("Loading application...").closest(".min-h-screen");
    expect(container).toBeInTheDocument();
  });
});
