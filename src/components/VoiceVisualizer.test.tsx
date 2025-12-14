/**
 * Tests for VoiceVisualizer Component
 * F004: Voice feedback visualization
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceVisualizer, useVoiceVisualizerData } from "./VoiceVisualizer";

describe("VoiceVisualizer", () => {
  describe("Waveform variant", () => {
    it("should render with default props", () => {
      const { container } = render(<VoiceVisualizer />);

      // Should render bars (default medium size = 32 bars)
      const bars = container.querySelectorAll("div[class*='w-1'][class*='rounded-full']");
      expect(bars.length).toBe(32);
    });

    it("should render correct number of bars for each size", () => {
      const { container: smallContainer } = render(<VoiceVisualizer size="small" />);
      expect(smallContainer.querySelectorAll("div[class*='w-1'][class*='rounded-full']").length).toBe(16);

      const { container: mediumContainer } = render(<VoiceVisualizer size="medium" />);
      expect(mediumContainer.querySelectorAll("div[class*='w-1'][class*='rounded-full']").length).toBe(32);

      const { container: largeContainer } = render(<VoiceVisualizer size="large" />);
      expect(largeContainer.querySelectorAll("div[class*='w-1'][class*='rounded-full']").length).toBe(64);
    });

    it("should apply theme colors", () => {
      const { container: emeraldContainer } = render(<VoiceVisualizer theme="emerald" isActive />);
      expect(emeraldContainer.innerHTML).toContain("bg-emerald-400");

      const { container: blueContainer } = render(<VoiceVisualizer theme="blue" isActive />);
      expect(blueContainer.innerHTML).toContain("bg-blue-400");

      const { container: purpleContainer } = render(<VoiceVisualizer theme="purple" isActive />);
      expect(purpleContainer.innerHTML).toContain("bg-purple-400");
    });

    it("should show inactive state when not active", () => {
      const { container } = render(<VoiceVisualizer isActive={false} />);

      // Bars should be in inactive state
      const bars = container.querySelectorAll("div[class*='bg-emerald-400']");
      expect(bars.length).toBeGreaterThan(0); // Should have bars
      // Check that most bars have inactive styling (opacity /20)
      const inactiveBars = Array.from(bars).filter((bar) => bar.className.includes("/20"));
      expect(inactiveBars.length).toBeGreaterThan(bars.length / 2); // Most bars should be inactive
    });

    it("should animate bars when active", async () => {
      const { container, rerender } = render(<VoiceVisualizer isActive={true} volume={128} />);

      // Wait for animation to start
      await waitFor(() => {
        const bars = container.querySelectorAll("div > div");
        const hasActiveBar = Array.from(bars).some((bar) => {
          const height = (bar as HTMLElement).style.height;
          return height && parseFloat(height) > 5; // Some bars should have height > 5%
        });
        expect(hasActiveBar).toBe(true);
      });
    });

    it("should respond to volume changes", async () => {
      const { container, rerender } = render(<VoiceVisualizer isActive={true} volume={50} />);

      // Change to higher volume
      rerender(<VoiceVisualizer isActive={true} volume={200} />);

      // Should affect bar heights (though exact heights depend on animation)
      await waitFor(() => {
        const bars = container.querySelectorAll("div > div");
        const hasHighBar = Array.from(bars).some((bar) => {
          const height = (bar as HTMLElement).style.height;
          return height && parseFloat(height) > 20; // Should have taller bars
        });
        expect(hasHighBar).toBe(true);
      });
    });

    it("should apply custom className", () => {
      const { container } = render(<VoiceVisualizer className="custom-class" />);
      expect(container.innerHTML).toContain("custom-class");
    });

    it("should reset bars when becoming inactive", async () => {
      const { container, rerender } = render(<VoiceVisualizer isActive={true} volume={200} />);

      // Wait for bars to animate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make inactive
      rerender(<VoiceVisualizer isActive={false} volume={0} />);

      // Bars should reset to low heights
      await waitFor(() => {
        const bars = container.querySelectorAll("div > div");
        const allBarsLow = Array.from(bars).every((bar) => {
          const height = (bar as HTMLElement).style.height;
          return !height || parseFloat(height) <= 5;
        });
        expect(allBarsLow).toBe(true);
      });
    });
  });

  describe("Level variant", () => {
    it("should render level meter", () => {
      const { container } = render(<VoiceVisualizer variant="level" />);

      // Should have level meter structure (not bars)
      const bars = container.querySelectorAll("div > div");
      expect(bars.length).toBeLessThan(10); // Not 32 bars
    });

    it("should show volume as percentage width", () => {
      const { container } = render(<VoiceVisualizer variant="level" volume={127} isActive={true} />);

      // Volume 127/255 ≈ 49.8%
      // Get the second div (the level bar with style.width)
      const allDivs = container.querySelectorAll("div");
      const levelBar = Array.from(allDivs).find(
        (div) => div.style.width && div.style.width.length > 0,
      ) as HTMLElement;
      expect(levelBar?.style.width).toMatch(/4[0-9]%|5[0-9]%/); // Around 50%
    });

    it("should show idle text when not active", () => {
      const { container } = render(<VoiceVisualizer variant="level" isActive={false} />);
      // Should show Idle text
      const idleText = container.querySelector("div[class*='text-zinc-500']");
      expect(idleText?.textContent).toBe("Idle");
    });

    it("should not show idle text when active", () => {
      const { container } = render(<VoiceVisualizer variant="level" isActive={true} volume={100} />);
      // Idle text should not be present
      expect(container.textContent).not.toContain("Idle");
    });

    it("should handle maximum volume", () => {
      const { container } = render(<VoiceVisualizer variant="level" volume={255} isActive={true} />);

      const allDivs = container.querySelectorAll("div");
      const levelBar = Array.from(allDivs).find(
        (div) => div.style.width && div.style.width.length > 0,
      ) as HTMLElement;
      expect(levelBar?.style.width).toBe("100%");
    });

    it("should handle zero volume", () => {
      const { container } = render(<VoiceVisualizer variant="level" volume={0} isActive={true} />);

      const allDivs = container.querySelectorAll("div");
      const levelBar = Array.from(allDivs).find(
        (div) => div.style.width && div.style.width.length > 0,
      ) as HTMLElement;
      expect(levelBar?.style.width).toBe("0%");
    });
  });

  describe("Performance", () => {
    it("should render within performance budget", () => {
      const startTime = performance.now();
      render(<VoiceVisualizer isActive={true} volume={128} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      // Initial render can take longer, but should be reasonable (< 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it("should handle rapid volume updates", () => {
      const { rerender } = render(<VoiceVisualizer isActive={true} volume={0} />);

      // Simulate rapid updates (every frame)
      const startTime = performance.now();
      for (let i = 0; i < 60; i++) {
        const volume = Math.sin(i / 10) * 128 + 128; // Oscillating volume
        rerender(<VoiceVisualizer isActive={true} volume={volume} />);
      }
      const endTime = performance.now();

      // Should handle 60 updates quickly
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should cleanup animation frame on unmount", () => {
      const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame");

      const { unmount } = render(<VoiceVisualizer isActive={true} volume={128} />);
      unmount();

      // Should have called cancelAnimationFrame
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should be renderable in reduced motion mode", () => {
      // Mock prefers-reduced-motion
      const mediaQueryList = {
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.spyOn(window, "matchMedia").mockReturnValue(mediaQueryList as unknown as MediaQueryList);

      const { container } = render(<VoiceVisualizer isActive={true} volume={128} />);

      // Should still render without crashing
      expect(container.querySelector("div")).toBeInTheDocument();
    });

    it("should have proper contrast in inactive state", () => {
      const { container } = render(<VoiceVisualizer isActive={false} />);

      // Inactive bars should have reduced opacity but still visible
      const bars = container.querySelectorAll("div[class*='bg-emerald-400']");
      expect(bars.length).toBeGreaterThan(0); // Should have bars
      // Check that bars have inactive opacity styling
      const inactiveBars = Array.from(bars).filter((bar) => bar.className.includes("/20"));
      expect(inactiveBars.length).toBeGreaterThan(bars.length / 2); // Most should have /20 opacity
    });
  });

  describe("Edge cases", () => {
    it("should handle negative volume", () => {
      const { container } = render(<VoiceVisualizer variant="level" volume={-10} isActive={true} />);

      const allDivs = container.querySelectorAll("div");
      const levelBar = Array.from(allDivs).find(
        (div) => div.style.width && div.style.width.length > 0,
      ) as HTMLElement;
      // Should clamp to 0%
      expect(levelBar?.style.width).toBe("0%");
    });

    it("should handle volume above 255", () => {
      const { container } = render(<VoiceVisualizer variant="level" volume={300} isActive={true} />);

      const allDivs = container.querySelectorAll("div");
      const levelBar = Array.from(allDivs).find(
        (div) => div.style.width && div.style.width.length > 0,
      ) as HTMLElement;
      // Should clamp to 100%
      expect(levelBar?.style.width).toBe("100%");
    });

    it("should handle rapid active/inactive toggling", async () => {
      const { rerender } = render(<VoiceVisualizer isActive={false} />);

      // Toggle rapidly
      for (let i = 0; i < 20; i++) {
        rerender(<VoiceVisualizer isActive={i % 2 === 0} volume={100} />);
      }

      // Should not crash
      expect(true).toBe(true);
    });
  });
});

describe("useVoiceVisualizerData", () => {
  it("should provide default values", () => {
    let hookResult: ReturnType<typeof useVoiceVisualizerData>;

    function TestComponent() {
      hookResult = useVoiceVisualizerData();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult!.volume).toBe(0);
    expect(hookResult!.isActive).toBe(false);
    expect(typeof hookResult!.updateVolume).toBe("function");
    expect(typeof hookResult!.updateActive).toBe("function");
  });

  it("should update volume state", () => {
    let hookResult: ReturnType<typeof useVoiceVisualizerData>;

    function TestComponent() {
      hookResult = useVoiceVisualizerData();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      hookResult!.updateVolume(150);
    });

    expect(hookResult!.volume).toBe(150);
  });

  it("should update active state", () => {
    let hookResult: ReturnType<typeof useVoiceVisualizerData>;

    function TestComponent() {
      hookResult = useVoiceVisualizerData();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      hookResult!.updateActive(true);
    });

    expect(hookResult!.isActive).toBe(true);
  });
});
