/**
 * Privacy indicator component for microphone status
 * F024: Privacy indicator for microphone status
 *
 * Shows a visual indicator (red dot with pulse) when microphone is active
 * Displays permission state and provides accessible information
 */

"use client";

import React, { useEffect, useState } from "react";
import { checkMicrophonePermission, watchMicrophonePermission } from "@/lib/voice/permissions";
import type { MicrophonePermissionState } from "@/lib/voice/types";

export interface PrivacyIndicatorProps {
  /** Whether the microphone is currently active/listening */
  isActive: boolean;
  /** Show in compact mode (dot only, no label) */
  compact?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Get tooltip text based on current state
 */
function getTooltipText(isActive: boolean, permissionState: MicrophonePermissionState): string {
  if (isActive) {
    return "Microphone is active and listening. Your voice is being captured.";
  }

  switch (permissionState) {
    case "granted":
      return "Microphone access granted. Click the microphone button to start recording.";
    case "denied":
      return "Microphone access denied. Please enable microphone permissions in your browser settings.";
    case "prompt":
      return "Microphone access not yet requested. Click the microphone button to enable.";
    case "unknown":
    default:
      return "Microphone status unknown. Your browser may not support microphone access.";
  }
}

/**
 * Get accessible label for screen readers
 */
function getAriaLabel(isActive: boolean, permissionState: MicrophonePermissionState): string {
  if (isActive) {
    return "Microphone active - recording in progress";
  }

  switch (permissionState) {
    case "granted":
      return "Microphone inactive - permission granted";
    case "denied":
      return "Microphone inactive - permission denied";
    case "prompt":
      return "Microphone inactive - permission not requested";
    case "unknown":
    default:
      return "Microphone inactive - status unknown";
  }
}

export function PrivacyIndicator({ isActive, compact = false, className = "" }: PrivacyIndicatorProps) {
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>("unknown");

  // Check initial permission state
  useEffect(() => {
    checkMicrophonePermission()
      .then((result) => {
        setPermissionState(result.state);
      })
      .catch((error) => {
        console.warn("Failed to check microphone permission:", error);
        setPermissionState("unknown");
      });
  }, []);

  // Watch for permission changes
  useEffect(() => {
    let unwatch: (() => void) | null = null;

    try {
      unwatch = watchMicrophonePermission((state) => {
        setPermissionState(state);
      });
    } catch (error) {
      console.warn("Failed to watch microphone permission:", error);
    }

    return () => {
      if (unwatch) {
        unwatch();
      }
    };
  }, []);

  const tooltip = getTooltipText(isActive, permissionState);
  const ariaLabel = getAriaLabel(isActive, permissionState);

  // Determine dot color and animation based on state
  const dotClass = isActive
    ? "bg-red-600 animate-pulse shadow-lg shadow-red-500/50"
    : "bg-zinc-500";

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={ariaLabel}
        title={tooltip}
        className={`inline-flex items-center justify-center ${className}`}
      >
        <span
          data-testid="mic-dot"
          className={`h-3 w-3 rounded-full ${dotClass}`}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={tooltip}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
        isActive
          ? "bg-red-500/15 text-red-200"
          : "bg-zinc-800/50 text-zinc-400"
      } ${className}`}
    >
      <span
        data-testid="mic-dot"
        className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span className="uppercase tracking-wider">
        {isActive ? "Microphone active" : "Microphone inactive"}
      </span>
    </div>
  );
}
