"use client";

/**
 * Voice Visualizer Component
 * F004: Voice feedback visualization
 *
 * Displays a real-time waveform or level indicator when user is speaking.
 * - Waveform animates in real-time
 * - Matches audio levels
 * - 60fps smooth animation
 */

import React, { useEffect, useRef, useState } from "react";

export interface VoiceVisualizerProps {
  /**
   * Current audio volume level (0-255)
   */
  volume?: number;

  /**
   * Whether voice activity is currently detected
   */
  isActive?: boolean;

  /**
   * Visualization style
   * - 'waveform': Animated bars visualization
   * - 'level': Simple level meter
   * Default: 'waveform'
   */
  variant?: "waveform" | "level";

  /**
   * Color theme
   * Default: 'emerald'
   */
  theme?: "emerald" | "blue" | "purple";

  /**
   * Size of the visualizer
   * Default: 'medium'
   */
  size?: "small" | "medium" | "large";

  /**
   * Additional CSS classes
   */
  className?: string;
}

const themeColors = {
  emerald: {
    active: "bg-emerald-400",
    inactive: "bg-emerald-400/20",
    glow: "shadow-emerald-400/50",
  },
  blue: {
    active: "bg-blue-400",
    inactive: "bg-blue-400/20",
    glow: "shadow-blue-400/50",
  },
  purple: {
    active: "bg-purple-400",
    inactive: "bg-purple-400/20",
    glow: "shadow-purple-400/50",
  },
};

const sizeConfig = {
  small: {
    containerHeight: "h-12",
    barCount: 16,
    barWidth: "w-1",
    gap: "gap-0.5",
  },
  medium: {
    containerHeight: "h-20",
    barCount: 32,
    barWidth: "w-1",
    gap: "gap-1",
  },
  large: {
    containerHeight: "h-32",
    barCount: 64,
    barWidth: "w-1.5",
    gap: "gap-1",
  },
};

export function VoiceVisualizer({
  volume = 0,
  isActive = false,
  variant = "waveform",
  theme = "emerald",
  size = "medium",
  className = "",
}: VoiceVisualizerProps) {
  const [barHeights, setBarHeights] = useState<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const previousVolumesRef = useRef<number[]>([]);

  const config = sizeConfig[size];
  const colors = themeColors[theme];

  // Initialize bar heights
  useEffect(() => {
    const initialHeights = Array(config.barCount).fill(0);
    setBarHeights(initialHeights);
    previousVolumesRef.current = Array(config.barCount).fill(0);
  }, [config.barCount]);

  // Animate bars based on volume changes
  useEffect(() => {
    if (!isActive || variant !== "waveform") {
      // Reset to idle state
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setBarHeights(Array(config.barCount).fill(0));
      return;
    }

    const animate = () => {
      setBarHeights((prevHeights) => {
        const newHeights = prevHeights.map((height, index) => {
          // Normalize volume to 0-1 range
          const normalizedVolume = Math.min(volume / 255, 1);

          // Create wave effect by offsetting each bar
          const offset = (index / config.barCount) * Math.PI * 2;
          const wave = Math.sin(Date.now() / 200 + offset);

          // Combine volume with wave for natural movement
          const targetHeight = normalizedVolume * (0.3 + (wave * 0.5 + 0.5) * 0.7);

          // Smooth transition using lerp
          const smoothingFactor = 0.3;
          return height + (targetHeight - height) * smoothingFactor;
        });

        return newHeights;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [volume, isActive, variant, config.barCount]);

  if (variant === "level") {
    // Simple level meter variant
    const normalizedVolume = Math.max(0, Math.min((volume / 255) * 100, 100));

    return (
      <div className={`relative overflow-hidden rounded-full ${config.containerHeight} ${className}`}>
        <div className="absolute inset-0 bg-zinc-800/50" />
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-100 ${colors.active} ${isActive ? colors.glow : ""}`}
          style={{
            width: `${normalizedVolume}%`,
            boxShadow: isActive ? `0 0 20px ${colors.glow}` : "none",
          }}
        />
        {!isActive && <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">Idle</div>}
      </div>
    );
  }

  // Waveform variant
  return (
    <div className={`flex items-center justify-center ${config.containerHeight} ${config.gap} ${className}`}>
      {barHeights.map((height, index) => {
        const barHeight = Math.max(height * 100, 2); // Minimum 2% height
        const isActiveBar = isActive && height > 0.05;

        return (
          <div
            key={index}
            className={`${config.barWidth} rounded-full transition-all duration-75 ${
              isActiveBar ? colors.active : colors.inactive
            }`}
            style={{
              height: `${barHeight}%`,
              transform: `scaleY(${isActive ? 1 : 0.5})`,
              boxShadow: isActiveBar ? `0 0 8px currentColor` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Hook to connect VoiceVisualizer with VoiceActivityDetector
 *
 * @example
 * ```tsx
 * const { volume, isActive } = useVoiceVisualizerData(vad);
 * return <VoiceVisualizer volume={volume} isActive={isActive} />;
 * ```
 */
export function useVoiceVisualizerData() {
  const [volume, setVolume] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // This will be connected to VAD in the integration phase
  const updateVolume = (newVolume: number) => {
    setVolume(newVolume);
  };

  const updateActive = (active: boolean) => {
    setIsActive(active);
  };

  return {
    volume,
    isActive,
    updateVolume,
    updateActive,
  };
}
