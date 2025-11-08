import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AnimatedHeadline } from "./AnimatedHeadline";

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<EventListener>();

  const mediaQuery: MediaQueryList = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_: string, listener: EventListener | EventListenerObject | null) => {
      if (listener) {
        listeners.add(listener as EventListener);
      }
    },
    removeEventListener: (_: string, listener: EventListener | EventListenerObject | null) => {
      if (listener) {
        listeners.delete(listener as EventListener);
      }
    },
    addListener: (listener: EventListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: EventListener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => mediaQuery),
  });
}

describe("AnimatedHeadline", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  test("renders animated phrases and interval when motion is allowed", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<AnimatedHeadline phrases={["One", "Two", "Three"]} />);

    expect(screen.getByTestId("animated-headline")).toHaveAttribute("data-motion", "enabled");
    expect(screen.queryByTestId("static-phrase")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("animated-phrase")).toHaveLength(3);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  test("short-circuits animation when reduced motion is preferred", async () => {
    mockMatchMedia(true);
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<AnimatedHeadline phrases={["Quiet", "Calm"]} />);

    await waitFor(() => {
      expect(screen.getByTestId("animated-headline")).toHaveAttribute("data-motion", "reduced");
    });

    expect(screen.getByTestId("static-phrase")).toHaveTextContent("Quiet");
    expect(screen.queryAllByTestId("animated-phrase")).toHaveLength(0);
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
