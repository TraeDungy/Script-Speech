/**
 * Microphone permission handling utilities
 * F003: Microphone permission handling
 */

import type { MicrophonePermissionResult, AudioDevice } from "./types";

/**
 * Check current microphone permission state without triggering a prompt
 */
export async function checkMicrophonePermission(): Promise<MicrophonePermissionResult> {
  // Check if we're in a browser environment
  if (typeof navigator === "undefined" || typeof navigator.permissions === "undefined") {
    return {
      state: "unknown",
      error: "Permissions API not available",
    };
  }

  try {
    // Query the microphone permission status
    const permissionStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });

    return {
      state: permissionStatus.state as MicrophonePermissionResult["state"],
    };
  } catch (error) {
    // Permissions API query might not be supported or might fail
    // Fall back to checking if we can enumerate devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInputs = devices.some((device) => device.kind === "audioinput");

      return {
        state: hasAudioInputs ? "prompt" : "unknown",
        error: error instanceof Error ? error.message : "Permission check failed",
      };
    } catch {
      return {
        state: "unknown",
        error: "Unable to check microphone permission",
      };
    }
  }
}

/**
 * Request microphone permission from the user
 * This will trigger the browser's permission prompt
 */
export async function requestMicrophonePermission(): Promise<MicrophonePermissionResult> {
  // Check if we're in a browser environment
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices === "undefined") {
    return {
      state: "unknown",
      error: "Media devices API not available",
    };
  }

  try {
    // Request microphone access
    // This will trigger the browser's permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Stop all tracks immediately since we only want to check permission
    stream.getTracks().forEach((track) => track.stop());

    return {
      state: "granted",
    };
  } catch (error) {
    // Handle specific error types
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        return {
          state: "denied",
          error: "Microphone access was denied by the user",
        };
      }

      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        return {
          state: "denied",
          error: "No microphone was found on this device",
        };
      }

      if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        return {
          state: "denied",
          error: "Microphone is already in use by another application",
        };
      }

      if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
        return {
          state: "denied",
          error: "Could not satisfy microphone constraints",
        };
      }

      if (error.name === "SecurityError") {
        return {
          state: "denied",
          error: "Microphone access is not allowed on this page (insecure context)",
        };
      }
    }

    return {
      state: "denied",
      error: error instanceof Error ? error.message : "Failed to access microphone",
    };
  }
}

/**
 * Get list of available audio input devices
 */
export async function getAudioInputDevices(): Promise<AudioDevice[]> {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices === "undefined") {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
        kind: device.kind,
        groupId: device.groupId,
      }));
  } catch (error) {
    console.error("Failed to enumerate audio devices:", error);
    return [];
  }
}

/**
 * Check if the browser supports the required APIs for voice features
 */
export function checkVoiceSupport(): {
  supported: boolean;
  features: {
    getUserMedia: boolean;
    audioContext: boolean;
    mediaRecorder: boolean;
    permissions: boolean;
  };
} {
  const features = {
    getUserMedia:
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function",
    audioContext: typeof AudioContext !== "undefined" || typeof (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext !== "undefined",
    mediaRecorder: typeof MediaRecorder !== "undefined",
    permissions: typeof navigator !== "undefined" && typeof navigator.permissions !== "undefined",
  };

  return {
    supported: features.getUserMedia && features.audioContext,
    features,
  };
}

/**
 * Create a listener for permission state changes
 */
export function watchMicrophonePermission(callback: (state: MicrophonePermissionResult["state"]) => void): () => void {
  if (typeof navigator === "undefined" || typeof navigator.permissions === "undefined") {
    return () => {
      /* no-op */
    };
  }

  let permissionStatus: PermissionStatus | null = null;

  const handleChange = () => {
    if (permissionStatus) {
      callback(permissionStatus.state as MicrophonePermissionResult["state"]);
    }
  };

  // Setup the watcher
  navigator.permissions
    .query({ name: "microphone" as PermissionName })
    .then((status) => {
      permissionStatus = status;
      permissionStatus.addEventListener("change", handleChange);
      // Call callback immediately with current state
      callback(status.state as MicrophonePermissionResult["state"]);
    })
    .catch((error) => {
      console.warn("Failed to watch microphone permission:", error);
      callback("unknown");
    });

  // Return cleanup function
  return () => {
    if (permissionStatus) {
      permissionStatus.removeEventListener("change", handleChange);
    }
  };
}
