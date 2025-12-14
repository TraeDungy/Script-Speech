/**
 * Tests for PrivacyIndicator component
 * F024: Privacy indicator for microphone status
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { PrivacyIndicator } from "./PrivacyIndicator";
import * as permissions from "@/lib/voice/permissions";

// Mock the permissions module
vi.mock("@/lib/voice/permissions", () => ({
  checkMicrophonePermission: vi.fn(),
  watchMicrophonePermission: vi.fn(),
}));

describe("PrivacyIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render without crashing", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should have accessible role and aria attributes", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);
      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute("aria-live", "polite");
      expect(indicator).toHaveAttribute("aria-atomic", "true");
    });

    it("should have a tooltip with explanatory text", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);
      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute("title");
      expect(indicator.getAttribute("title")).toBeTruthy();
    });
  });

  describe("Inactive State", () => {
    it("should show gray dot when microphone is inactive", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);
      const indicator = screen.getByRole("status");
      expect(indicator).toBeInTheDocument();
      expect(indicator.textContent).toContain("Microphone inactive");
    });

    it("should have proper tooltip for inactive state", async () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);

      await waitFor(() => {
        const indicator = screen.getByRole("status");
        const title = indicator.getAttribute("title");
        // Should have an informative tooltip (checking for microphone-related content)
        expect(title).toBeTruthy();
        expect(title).toMatch(/microphone/i);
      });
    });
  });

  describe("Active State", () => {
    it("should show red dot when microphone is active", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "granted" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={true} />);
      const indicator = screen.getByRole("status");
      expect(indicator).toBeInTheDocument();
      expect(indicator.textContent).toContain("Microphone active");
    });

    it("should have pulse animation when active", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "granted" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={true} />);
      const dot = screen.getByRole("status").querySelector('[data-testid="mic-dot"]');
      expect(dot).toBeInTheDocument();
      expect(dot?.className).toContain("animate-pulse");
    });

    it("should have proper tooltip for active state", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "granted" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={true} />);
      const indicator = screen.getByRole("status");
      const title = indicator.getAttribute("title");
      expect(title).toContain("active");
      expect(title).toContain("listening");
    });
  });

  describe("Permission States", () => {
    it("should show warning when permission is denied", async () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "denied" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);

      await waitFor(() => {
        const indicator = screen.getByRole("status");
        const title = indicator.getAttribute("title");
        expect(title).toContain("denied");
      });
    });

    it("should show prompt when permission is not yet requested", async () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);

      await waitFor(() => {
        const indicator = screen.getByRole("status");
        const title = indicator.getAttribute("title");
        expect(title).toBeTruthy();
      });
    });

    it("should update tooltip when permission is granted", async () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "granted" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);

      await waitFor(() => {
        const indicator = screen.getByRole("status");
        const title = indicator.getAttribute("title");
        expect(title).toContain("granted");
      });
    });
  });

  describe("Permission Watching", () => {
    it("should watch permission changes", () => {
      const unwatch = vi.fn();
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(unwatch);

      const { unmount } = render(<PrivacyIndicator isActive={false} />);
      expect(permissions.watchMicrophonePermission).toHaveBeenCalledTimes(1);
      expect(permissions.watchMicrophonePermission).toHaveBeenCalledWith(expect.any(Function));

      unmount();
      expect(unwatch).toHaveBeenCalledTimes(1);
    });

    it("should update UI when permission state changes", async () => {
      let callback: ((state: string) => void) | null = null;
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockImplementation((cb) => {
        callback = cb;
        // Call immediately with initial state
        cb("prompt");
        return () => {};
      });

      render(<PrivacyIndicator isActive={false} />);

      // Wait for initial render to complete
      await waitFor(() => {
        expect(callback).not.toBeNull();
      });

      // Simulate permission being granted
      if (callback) {
        callback("granted");
      }

      await waitFor(() => {
        const indicator = screen.getByRole("status");
        const title = indicator.getAttribute("title");
        expect(title).toContain("granted");
      });
    });
  });

  describe("Visual Appearance", () => {
    it("should have red background when active", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "granted" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={true} />);
      const dot = screen.getByRole("status").querySelector('[data-testid="mic-dot"]');
      expect(dot?.className).toContain("bg-red");
    });

    it("should have gray background when inactive", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);
      const dot = screen.getByRole("status").querySelector('[data-testid="mic-dot"]');
      expect(dot?.className).toContain("bg-zinc");
    });

    it("should be rounded", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);
      const dot = screen.getByRole("status").querySelector('[data-testid="mic-dot"]');
      expect(dot?.className).toContain("rounded-full");
    });
  });

  describe("Compact Mode", () => {
    it("should render in compact mode without label", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} compact={true} />);
      const indicator = screen.getByRole("status");
      expect(indicator).toBeInTheDocument();

      // In compact mode, there should be no visible text label
      const hasVisibleLabel = indicator.textContent?.includes("Microphone");
      expect(hasVisibleLabel).toBe(false);
    });

    it("should still have accessible label in compact mode", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} compact={true} />);
      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute("aria-label");
    });
  });

  describe("Error Handling", () => {
    it("should handle permission check errors gracefully", async () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({
        state: "unknown",
        error: "Permission check failed"
      });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={false} />);

      await waitFor(() => {
        const indicator = screen.getByRole("status");
        expect(indicator).toBeInTheDocument();
      });
    });

    it("should not crash when watch function fails", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockImplementation(() => {
        throw new Error("Watch failed");
      });

      expect(() => render(<PrivacyIndicator isActive={false} />)).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should announce state changes to screen readers", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "prompt" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      const { rerender } = render(<PrivacyIndicator isActive={false} />);
      rerender(<PrivacyIndicator isActive={true} />);

      const indicator = screen.getByRole("status");
      expect(indicator).toHaveAttribute("aria-live", "polite");
    });

    it("should have sufficient color contrast", () => {
      vi.mocked(permissions.checkMicrophonePermission).mockResolvedValue({ state: "granted" });
      vi.mocked(permissions.watchMicrophonePermission).mockReturnValue(() => {});

      render(<PrivacyIndicator isActive={true} />);
      const dot = screen.getByRole("status").querySelector('[data-testid="mic-dot"]');

      // Red dot should be bright enough for visibility
      expect(dot?.className).toMatch(/bg-red-(500|600|700)/);
    });
  });
});
