/**
 * CommandRegistry - Plugin system for reader commands
 * 
 * Allows plugins to register commands that can be triggered programmatically
 * or via keyboard shortcuts, menus, or the command palette.
 */

export interface CommandContext {
  bookKey?: string;
  [key: string]: unknown;
}

export type CommandHandler = (context?: CommandContext) => void | Promise<void>;

export interface Command {
  id: string;
  label: string;
  description?: string;
  category?: string;
  shortcut?: string;
  icon?: string;
  handler: CommandHandler;
  isEnabled?: () => boolean;
  isVisible?: () => boolean;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  commands: Command[];
  activate?: () => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

class CommandRegistry {
  private commands = new Map<string, Command>();
  private plugins = new Map<string, Plugin>();
  private keyBindings = new Map<string, string>(); // shortcut -> command id

  /**
   * Register a single command
   */
  registerCommand(command: Command): () => void {
    this.commands.set(command.id, command);
    if (command.shortcut) {
      this.keyBindings.set(command.shortcut.toLowerCase(), command.id);
    }
    return () => this.unregisterCommand(command.id);
  }

  /**
   * Unregister a command
   */
  unregisterCommand(id: string): void {
    const command = this.commands.get(id);
    if (command?.shortcut) {
      this.keyBindings.delete(command.shortcut.toLowerCase());
    }
    this.commands.delete(id);
  }

  /**
   * Install a plugin and register all its commands
   */
  async installPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      await this.uninstallPlugin(plugin.id);
    }
    this.plugins.set(plugin.id, plugin);
    for (const command of plugin.commands) {
      this.registerCommand(command);
    }
    if (plugin.activate) {
      await plugin.activate();
    }
  }

  /**
   * Uninstall a plugin and remove all its commands
   */
  async uninstallPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    if (plugin.deactivate) {
      await plugin.deactivate();
    }
    for (const command of plugin.commands) {
      this.unregisterCommand(command.id);
    }
    this.plugins.delete(id);
  }

  /**
   * Execute a command by ID
   */
  async executeCommand(id: string, context?: CommandContext): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      console.warn(`Command not found: ${id}`);
      return;
    }
    if (command.isEnabled && !command.isEnabled()) {
      console.warn(`Command disabled: ${id}`);
      return;
    }
    await command.handler(context);
  }

  /**
   * Handle a keyboard event and execute the matching command
   */
  async handleKeyboardShortcut(event: KeyboardEvent, context?: CommandContext): Promise<boolean> {
    const shortcut = this.getShortcutString(event);
    const commandId = this.keyBindings.get(shortcut.toLowerCase());
    if (commandId) {
      event.preventDefault();
      await this.executeCommand(commandId, context);
      return true;
    }
    return false;
  }

  private getShortcutString(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * Get all registered commands, optionally filtered by category
   */
  getCommands(category?: string): Command[] {
    const all = Array.from(this.commands.values());
    if (category) return all.filter((c) => c.category === category);
    return all;
  }

  /**
   * Get all installed plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Search commands by query
   */
  searchCommands(query: string): Command[] {
    const q = query.toLowerCase();
    return this.getCommands().filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }
}

// Singleton registry
export const commandRegistry = new CommandRegistry();

// Core reader commands
export const CORE_COMMANDS = {
  NAVIGATE_NEXT: 'reader.navigate.next',
  NAVIGATE_PREV: 'reader.navigate.prev',
  NAVIGATE_NEXT_SECTION: 'reader.navigate.nextSection',
  NAVIGATE_PREV_SECTION: 'reader.navigate.prevSection',
  TOGGLE_TOC: 'reader.toggle.toc',
  TOGGLE_SEARCH: 'reader.toggle.search',
  TOGGLE_SETTINGS: 'reader.toggle.settings',
  TOGGLE_FULLSCREEN: 'reader.toggle.fullscreen',
  ZOOM_IN: 'reader.zoom.in',
  ZOOM_OUT: 'reader.zoom.out',
  ZOOM_RESET: 'reader.zoom.reset',
  HISTORY_BACK: 'reader.history.back',
  HISTORY_FORWARD: 'reader.history.forward',
  COPY_TEXT: 'reader.copy.text',
  ADD_HIGHLIGHT: 'reader.annotation.highlight',
  ADD_BOOKMARK: 'reader.annotation.bookmark',
  ADD_NOTE: 'reader.annotation.note',
} as const;
