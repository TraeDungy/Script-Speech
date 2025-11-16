import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccessRequestForm } from "./AccessRequestForm";

describe("AccessRequestForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reveals project detail fields when toggled", () => {
    render(<AccessRequestForm />);

    expect(screen.queryByPlaceholderText("Studio or production company")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/add project details/i));
    expect(screen.getByPlaceholderText("Studio or production company")).toBeInTheDocument();
  });

  it("submits the form successfully", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "Thanks" }),
    } as Response);

    render(<AccessRequestForm />);

    fireEvent.change(screen.getByPlaceholderText("you@studio.com"), {
      target: { value: "demo@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Commercial short, feature, episodic"), {
      target: { value: "Feature" },
    });

    fireEvent.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/request-access",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByText("Thanks")).toBeInTheDocument();
  });

  it("surfaces backend errors", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: "Nope" }),
    } as Response);

    render(<AccessRequestForm />);

    fireEvent.change(screen.getByPlaceholderText("you@studio.com"), {
      target: { value: "demo@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /request access/i }));

    expect(await screen.findByText("Nope")).toBeInTheDocument();
  });
});
