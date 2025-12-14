/**
 * Autosave Manager
 * F085: Autosave every 10 seconds
 *
 * Manages automatic saving of script documents with configurable intervals,
 * status tracking, and debouncing to prevent excessive saves.
 */

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveConfig {
  /**
   * Interval in milliseconds between autosaves
   * @default 10000 (10 seconds)
   */
  interval?: number;

  /**
   * Debounce time in milliseconds to wait after last change before saving
   * @default 2000 (2 seconds)
   */
  debounceMs?: number;

  /**
   * Whether autosave is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Callback when save status changes
   */
  onStatusChange?: (status: AutosaveStatus) => void;

  /**
   * Callback when save succeeds
   */
  onSaveSuccess?: (timestamp: number) => void;

  /**
   * Callback when save fails
   */
  onSaveError?: (error: Error) => void;
}

export interface AutosaveState {
  status: AutosaveStatus;
  lastSaveTime: number | null;
  lastChangeTime: number | null;
  saveCount: number;
  errorCount: number;
}

/**
 * Autosave Manager class
 * Handles periodic and debounced saving with status tracking
 */
export class AutosaveManager<T = unknown> {
  private config: Required<Omit<AutosaveConfig, "onStatusChange" | "onSaveSuccess" | "onSaveError">>;
  private callbacks: Pick<AutosaveConfig, "onStatusChange" | "onSaveSuccess" | "onSaveError">;
  private state: AutosaveState;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private saveFunction: ((data: T) => Promise<void>) | null = null;
  private currentData: T | null = null;
  private lastSavedData: string | null = null;
  private isDestroyed = false;

  constructor(config: AutosaveConfig = {}) {
    this.config = {
      interval: config.interval ?? 10000, // 10 seconds default
      debounceMs: config.debounceMs ?? 2000, // 2 seconds debounce
      enabled: config.enabled ?? true,
    };

    this.callbacks = {
      onStatusChange: config.onStatusChange,
      onSaveSuccess: config.onSaveSuccess,
      onSaveError: config.onSaveError,
    };

    this.state = {
      status: "idle",
      lastSaveTime: null,
      lastChangeTime: null,
      saveCount: 0,
      errorCount: 0,
    };
  }

  /**
   * Initialize the autosave manager with a save function
   */
  setSaveFunction(fn: (data: T) => Promise<void>): void {
    this.saveFunction = fn;
  }

  /**
   * Mark data as changed and schedule a save
   */
  markChanged(data: T): void {
    if (!this.config.enabled || this.isDestroyed) {
      return;
    }

    this.currentData = data;
    this.state.lastChangeTime = Date.now();

    // Check if data actually changed
    const serialized = this.serializeData(data);
    if (serialized === this.lastSavedData) {
      return; // No actual changes
    }

    this.updateStatus("pending");
    this.scheduleDebouncedSave();
  }

  /**
   * Manually trigger a save immediately
   */
  async saveNow(): Promise<void> {
    if (!this.config.enabled || this.isDestroyed || !this.currentData) {
      return;
    }

    // Clear any pending saves
    this.clearDebounceTimer();

    await this.performSave(this.currentData);
  }

  /**
   * Start the periodic autosave interval
   */
  start(): void {
    if (this.intervalTimer || !this.config.enabled || this.isDestroyed) {
      return;
    }

    this.intervalTimer = setInterval(() => {
      if (this.state.status === "pending" && this.currentData) {
        void this.performSave(this.currentData);
      }
    }, this.config.interval);
  }

  /**
   * Stop the periodic autosave interval and clear any pending saves
   */
  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    // Also clear any debounced saves
    this.clearDebounceTimer();
  }

  /**
   * Pause autosaving (keeps interval running but skips saves)
   */
  pause(): void {
    this.config.enabled = false;
    this.clearDebounceTimer();
  }

  /**
   * Resume autosaving
   */
  resume(): void {
    this.config.enabled = true;
  }

  /**
   * Get current autosave state
   */
  getState(): Readonly<AutosaveState> {
    return { ...this.state };
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    if (!this.currentData) {
      return false;
    }

    const current = this.serializeData(this.currentData);
    return current !== this.lastSavedData;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutosaveConfig>): void {
    if (config.interval !== undefined) {
      this.config.interval = config.interval;
      // Restart interval with new timing
      if (this.intervalTimer) {
        this.stop();
        this.start();
      }
    }

    if (config.debounceMs !== undefined) {
      this.config.debounceMs = config.debounceMs;
    }

    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }

    if (config.onStatusChange !== undefined) {
      this.callbacks.onStatusChange = config.onStatusChange;
    }

    if (config.onSaveSuccess !== undefined) {
      this.callbacks.onSaveSuccess = config.onSaveSuccess;
    }

    if (config.onSaveError !== undefined) {
      this.callbacks.onSaveError = config.onSaveError;
    }
  }

  /**
   * Clean up and destroy the autosave manager
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.clearDebounceTimer();
    this.saveFunction = null;
    this.currentData = null;
    this.lastSavedData = null;
  }

  /**
   * Schedule a debounced save
   */
  private scheduleDebouncedSave(): void {
    this.clearDebounceTimer();

    this.debounceTimer = setTimeout(() => {
      if (this.currentData && this.config.enabled) {
        void this.performSave(this.currentData);
      }
    }, this.config.debounceMs);
  }

  /**
   * Perform the actual save operation
   */
  private async performSave(data: T): Promise<void> {
    if (!this.saveFunction || !this.config.enabled || this.isDestroyed) {
      return;
    }

    // Check if data changed since last save
    const serialized = this.serializeData(data);
    if (serialized === this.lastSavedData) {
      return; // No changes to save
    }

    this.updateStatus("saving");

    try {
      await this.saveFunction(data);

      this.lastSavedData = serialized;
      const now = Date.now();
      this.state.lastSaveTime = now;
      this.state.saveCount++;

      this.updateStatus("saved");

      if (this.callbacks.onSaveSuccess) {
        this.callbacks.onSaveSuccess(now);
      }

      // Reset to idle after brief delay to show "saved" status
      setTimeout(() => {
        if (this.state.status === "saved") {
          this.updateStatus("idle");
        }
      }, 1500);
    } catch (error) {
      this.state.errorCount++;
      this.updateStatus("error");

      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (this.callbacks.onSaveError) {
        this.callbacks.onSaveError(errorObj);
      }

      // Reset to pending after brief delay to allow retry
      setTimeout(() => {
        if (this.state.status === "error") {
          this.updateStatus("pending");
        }
      }, 3000);
    }
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(status: AutosaveStatus): void {
    if (this.state.status !== status) {
      this.state.status = status;

      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange(status);
      }
    }
  }

  /**
   * Serialize data for comparison
   */
  private serializeData(data: T): string {
    return JSON.stringify(data);
  }

  /**
   * Clear debounce timer
   */
  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

/**
 * Create an autosave manager instance
 */
export function createAutosave<T = unknown>(config: AutosaveConfig = {}): AutosaveManager<T> {
  return new AutosaveManager<T>(config);
}
