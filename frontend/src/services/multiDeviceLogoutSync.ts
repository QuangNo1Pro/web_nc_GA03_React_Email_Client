/**
 * Multi-Device Logout Sync - Frontend Service
 * Polls backend for logout events on other devices
 * No WebSocket or external dependencies needed
 */

import { api } from './api';

class MultiDeviceLogoutSync {
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastCheckTime: Date = new Date();
  private isPolling = false;
  private onLogoutCallback: (() => void) | null = null;

  /**
   * Start polling for logout events from other devices
   * Polls every 5 seconds
   */
  public startPolling(): void {
    if (this.isPolling) {
      console.warn('[MultiDeviceLogout] ⚠️ Polling already active');
      return;
    }

    this.isPolling = true;
    console.log('[MultiDeviceLogout] 🔄 Starting multi-device logout polling (every 5s)');

    // Poll immediately on start
    this.checkLogoutStatus();

    // Then poll every 5 seconds
    this.pollingInterval = setInterval(() => {
      this.checkLogoutStatus();
    }, 5000);
  }

  /**
   * Stop polling for logout events
   */
  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      console.log('[MultiDeviceLogout] ⏹️ Stopped polling');
    }
  }

  /**
   * Check if user has been logged out on another device
   */
  private async checkLogoutStatus(): Promise<void> {
    try {
      const response = await api.get('/auth/check-device-logout', {
        params: {
          lastCheck: this.lastCheckTime.toISOString(),
        },
      });

      const { loggedOut, currentTime } = response.data;

      // Update last check time
      this.lastCheckTime = new Date(currentTime);

      if (loggedOut) {
        console.log('[MultiDeviceLogout] 🚨 Logout detected on another device!');
        this.handleLogout();
      }
    } catch (error: any) {
      // 401 means user is not authenticated (already logged out)
      if (error.response?.status === 401) {
        console.log('[MultiDeviceLogout] 🔓 User session expired/invalid');
        this.handleLogout();
      } else {
        console.error('[MultiDeviceLogout] ❌ Error checking logout status:', error.message);
      }
    }
  }

  /**
   * Handle logout event from another device
   */
  private handleLogout(): void {
    if (this.onLogoutCallback) {
      console.log('[MultiDeviceLogout] 🔓 Executing logout callback');
      this.onLogoutCallback();
    }

    // Stop polling since we're logged out
    this.stopPolling();
  }

  /**
   * Register callback for logout events
   */
  public onLogout(callback: () => void): void {
    this.onLogoutCallback = callback;
    console.log('[MultiDeviceLogout] ✅ Logout callback registered');
  }

  /**
   * Check if polling is active
   */
  public isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopPolling();
    this.onLogoutCallback = null;
    console.log('[MultiDeviceLogout] 🧹 Cleaned up');
  }

  /**
   * Get polling status
   */
  public getStatus(): {
    isPolling: boolean;
    lastCheckTime: string;
  } {
    return {
      isPolling: this.isPolling,
      lastCheckTime: this.lastCheckTime.toISOString(),
    };
  }
}

// Export singleton instance
export const multiDeviceLogoutSync = new MultiDeviceLogoutSync();
