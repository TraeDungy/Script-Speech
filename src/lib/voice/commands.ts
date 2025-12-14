/**
 * Voice Command Handler
 * F011: Voice command detection and execution
 */

import { CommandParser, createCommandParser, type VoiceCommand } from "./commandParser";

export type CommandHandler = (command: VoiceCommand) => Promise<void> | void;

export interface CommandHandlerRegistry {
  [commandType: string]: CommandHandler;
}

export interface CommandExecutionResult {
  success: boolean;
  command: VoiceCommand;
  error?: string;
  message?: string;
}

/**
 * Voice Command Manager
 * Manages command detection and execution
 */
export class VoiceCommandManager {
  private parser: CommandParser;
  private handlers: CommandHandlerRegistry = {};
  private commandHistory: VoiceCommand[] = [];
  private maxHistorySize = 50;

  constructor(parser?: CommandParser) {
    this.parser = parser || createCommandParser();
  }

  /**
   * Register a handler for a specific command type
   */
  registerHandler(commandType: string, handler: CommandHandler): void {
    this.handlers[commandType] = handler;
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(commandType: string): void {
    delete this.handlers[commandType];
  }

  /**
   * Process transcribed text and execute commands
   */
  async processText(text: string): Promise<CommandExecutionResult | null> {
    // Parse the text for commands
    const command = this.parser.parse(text);

    if (!command) {
      return null;
    }

    // Add to history
    this.addToHistory(command);

    // Execute the command
    return await this.execute(command);
  }

  /**
   * Execute a voice command
   */
  async execute(command: VoiceCommand): Promise<CommandExecutionResult> {
    const handler = this.handlers[command.type];

    if (!handler) {
      return {
        success: false,
        command,
        error: `No handler registered for command type: ${command.type}`,
      };
    }

    try {
      await handler(command);
      return {
        success: true,
        command,
        message: `Command executed: ${command.type}`,
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get command history
   */
  getHistory(): VoiceCommand[] {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Get the most recent command
   */
  getLastCommand(): VoiceCommand | null {
    return this.commandHistory[this.commandHistory.length - 1] || null;
  }

  /**
   * Get available command types
   */
  getAvailableCommands(): string[] {
    return Object.keys(this.handlers);
  }

  /**
   * Get help information for all commands
   */
  getHelp(): Array<{ type: string; description: string }> {
    return this.parser.getHelp();
  }

  /**
   * Check if a command type is supported
   */
  isSupported(commandType: string): boolean {
    return commandType in this.handlers;
  }

  /**
   * Add command to history
   */
  private addToHistory(command: VoiceCommand): void {
    this.commandHistory.push(command);

    // Trim history if it exceeds max size
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
    }
  }
}

/**
 * Create a default voice command manager
 */
export function createCommandManager(parser?: CommandParser): VoiceCommandManager {
  return new VoiceCommandManager(parser);
}

/**
 * Helper function to create a debounced command processor
 * Prevents duplicate commands from being processed in quick succession
 */
export function createDebouncedProcessor(
  manager: VoiceCommandManager,
  debounceMs = 1000,
): (text: string) => Promise<CommandExecutionResult | null> {
  let lastCommandTime = 0;
  let lastCommandText = "";

  return async (text: string): Promise<CommandExecutionResult | null> => {
    const now = Date.now();
    const timeSinceLastCommand = now - lastCommandTime;

    // If same command text within debounce window, ignore
    if (text === lastCommandText && timeSinceLastCommand < debounceMs) {
      return null;
    }

    lastCommandTime = now;
    lastCommandText = text;

    return await manager.processText(text);
  };
}
