import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingSpinner from "../../components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders spinner with default size", () => {
    const { container } = render(<LoadingSpinner />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("h-6", "w-6"); // default md size
  });

  it("renders spinner with small size", () => {
    const { container } = render(<LoadingSpinner size="sm" />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toHaveClass("h-4", "w-4");
  });

  it("renders spinner with large size", () => {
    const { container } = render(<LoadingSpinner size="lg" />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toHaveClass("h-8", "w-8");
  });

  it("renders with text when provided", () => {
    render(<LoadingSpinner text="Loading data..." />);

    expect(screen.getByText("Loading data...")).toBeInTheDocument();
    expect(screen.getByText("Loading data...")).toHaveClass("text-sm", "text-muted-foreground");
  });

  it("does not render text when not provided", () => {
    const { container } = render(<LoadingSpinner />);

    const textElement = container.querySelector("span");
    expect(textElement).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("combines custom className with default classes", () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);

    expect(container.firstChild).toHaveClass("flex", "items-center", "justify-center", "gap-2", "custom-class");
  });

  it("renders with both text and custom className", () => {
    render(<LoadingSpinner text="Please wait..." className="my-custom-class" />);

    expect(screen.getByText("Please wait...")).toBeInTheDocument();
    expect(screen.getByText("Please wait...")).toHaveClass("text-sm", "text-muted-foreground");

    const container = screen.getByText("Please wait...").parentElement;
    expect(container).toHaveClass("my-custom-class");
  });

  it("has proper accessibility attributes", () => {
    const { container } = render(<LoadingSpinner />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();

    // The component should be focusable for screen readers
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("flex", "items-center", "justify-center");
  });
});
