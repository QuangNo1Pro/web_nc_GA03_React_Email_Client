/**
 * Logout Sync Service using BroadcastChannel
 * Synchronizes logout events across multiple browser tabs/windows
 * 
 * When user logs out in one tab, all other tabs automatically receive the logout event
 * and update their authentication state
 */

type LogoutSyncMessage = {
  type: 'logout' | 'login' | 'token-refresh';
  userId?: string;
  timestamp: number;
  tabId: string;
};

class LogoutSyncService {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private onLogoutCallback: (() => void) | null = null;
  private onLoginCallback: ((userId: string) => void) | null = null;
  private isInitialized = false;

  constructor() {
    // Generate unique tab ID for this instance
    this.tabId = this.generateTabId();
    this.initializeBroadcastChannel();
  }

  /**
   * Initialize BroadcastChannel if supported
   */
  private initializeBroadcastChannel(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('auth-sync');

        // Listen for messages from other tabs
        this.channel.onmessage = (event: MessageEvent<LogoutSyncMessage>) => {
          this.handleMessage(event.data);
        };

        this.isInitialized = true;
        console.log('[LogoutSync] 📡 BroadcastChannel initialized. Tab ID:', this.tabId);
      } else {
        console.warn('[LogoutSync] ⚠️ BroadcastChannel not supported in this browser');
      }
    } catch (error) {
      console.error('[LogoutSync] ❌ Failed to initialize BroadcastChannel:', error);
    }
  }

  /**
   * Generate unique ID for this tab
   */
  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle incoming messages from other tabs
   */
  private handleMessage(message: LogoutSyncMessage): void {
    // Ignore messages from this tab
    if (message.tabId === this.tabId) {
      return;
    }

    console.log('[LogoutSync] 📨 Received message:', message.type, 'from tab:', message.tabId);

    switch (message.type) {
      case 'logout':
        if (this.onLogoutCallback) {
          console.log('[LogoutSync] 🔓 Logout triggered from another tab');
          this.onLogoutCallback();
        }
        break;

      case 'login':
        if (this.onLoginCallback && message.userId) {
          console.log('[LogoutSync] 🔐 Login detected from another tab. User:', message.userId);
          this.onLoginCallback(message.userId);
        }
        break;

      case 'token-refresh':
        console.log('[LogoutSync] 🔄 Token refresh detected from another tab');
        // Token refresh is typically handled at request level, not needed here
        break;

      default:
        console.warn('[LogoutSync] ⚠️ Unknown message type:', (message as any).type);
    }
  }

  /**
   * Broadcast logout event to all other tabs
   */
  public broadcastLogout(): void {
    // Reinitialize channel if it was closed
    if (!this.channel || !this.isInitialized) {
      this.initializeBroadcastChannel();
    }

    if (!this.isInitialized || !this.channel) {
      console.warn('[LogoutSync] ⚠️ BroadcastChannel not available, skipping logout broadcast');
      return;
    }

    const message: LogoutSyncMessage = {
      type: 'logout',
      timestamp: Date.now(),
      tabId: this.tabId,
    };

    try {
      this.channel.postMessage(message);
      console.log('[LogoutSync] 📤 Logout broadcast sent');
    } catch (error) {
      console.error('[LogoutSync] ❌ Failed to broadcast logout:', error);
      // Try to reinitialize and resend
      this.isInitialized = false;
      this.channel = null;
    }
  }

  /**
   * Broadcast login event to all other tabs
   */
  public broadcastLogin(userId: string): void {
    // Reinitialize channel if it was closed
    if (!this.channel || !this.isInitialized) {
      this.initializeBroadcastChannel();
    }

    if (!this.isInitialized || !this.channel) {
      console.warn('[LogoutSync] ⚠️ BroadcastChannel not available, skipping login broadcast');
      return;
    }

    const message: LogoutSyncMessage = {
      type: 'login',
      userId,
      timestamp: Date.now(),
      tabId: this.tabId,
    };

    try {
      this.channel.postMessage(message);
      console.log('[LogoutSync] 📤 Login broadcast sent for user:', userId);
    } catch (error) {
      console.error('[LogoutSync] ❌ Failed to broadcast login:', error);
      // Try to reinitialize on next call
      this.isInitialized = false;
      this.channel = null;
    }
  }

  /**
   * Broadcast token refresh event
   */
  public broadcastTokenRefresh(): void {
    if (!this.channel || !this.isInitialized) {
      this.initializeBroadcastChannel();
    }

    if (!this.isInitialized || !this.channel) {
      return;
    }

    const message: LogoutSyncMessage = {
      type: 'token-refresh',
      timestamp: Date.now(),
      tabId: this.tabId,
    };

    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error('[LogoutSync] ❌ Failed to broadcast token refresh:', error);
      this.isInitialized = false;
      this.channel = null;
    }
  }

  /**
   * Register callback for logout events from other tabs
   */
  public onLogout(callback: () => void): void {
    this.onLogoutCallback = callback;
    console.log('[LogoutSync] ✅ Logout callback registered');
  }

  /**
   * Register callback for login events from other tabs
   */
  public onLogin(callback: (userId: string) => void): void {
    this.onLoginCallback = callback;
    console.log('[LogoutSync] ✅ Login callback registered');
  }

  /**
   * Clean up callbacks only (don't close channel - it's a singleton)
   */
  public cleanup(): void {
    // Don't close the channel! It's a singleton and needs to stay alive
    // Only clear the callbacks to prevent stale references
    this.onLogoutCallback = null;
    this.onLoginCallback = null;
    console.log('[LogoutSync] 🧹 Callbacks cleaned up (channel stays open)');
  }

  /**
   * Get current tab ID
   */
  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Check if BroadcastChannel is available
   */
  public isAvailable(): boolean {
    return this.isInitialized && this.channel !== null;
  }
}

// Export singleton instance
export const logoutSync = new LogoutSyncService();
