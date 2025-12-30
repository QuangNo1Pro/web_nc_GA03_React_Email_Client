/**
 * Multi-Device Logout Sync Service
 * 
 * Synchronizes logout events across multiple devices/machines using:
 * 1. Backend logout event tracking (in-memory + database)
 * 2. Frontend polling to check logout status
 * 3. No WebSocket or external dependencies needed
 */

import { Injectable, Logger } from '@nestjs/common';

export interface LogoutEvent {
  userId: string;
  timestamp: Date;
  deviceId?: string;
  ttl: number; // Time to live in seconds
}

@Injectable()
export class MultiDeviceLogoutService {
  private readonly logger = new Logger(MultiDeviceLogoutService.name);
  private logoutEvents: Map<string, LogoutEvent> = new Map(); // userId -> LogoutEvent

  constructor() {
    // Cleanup old logout events every 5 minutes
    setInterval(() => this.cleanupOldEvents(), 5 * 60 * 1000);
  }

  /**
   * Record a logout event for a user
   * This broadcasts logout to all devices/machines
   */
  recordLogout(userId: string, deviceId?: string): void {
    const logoutEvent: LogoutEvent = {
      userId,
      timestamp: new Date(),
      deviceId,
      ttl: 300, // 5 minutes
    };

    this.logoutEvents.set(userId, logoutEvent);
    
    this.logger.log(
      `[MultiDeviceLogout] 🔓 Logout recorded for user: ${userId}, device: ${deviceId || 'unknown'}`
    );
  }

  /**
   * Check if a user has logged out on another device
   * Returns true if logout event exists and is still valid
   */
  hasLogoutOccurred(userId: string, lastCheckTime: Date): boolean {
    const logoutEvent = this.logoutEvents.get(userId);
    
    if (!logoutEvent) {
      return false;
    }

    // Check if logout happened after last check
    const isAfterLastCheck = logoutEvent.timestamp > lastCheckTime;
    
    if (isAfterLastCheck) {
      this.logger.log(
        `[MultiDeviceLogout] ✅ Logout detected for user: ${userId}`
      );
      return true;
    }

    return false;
  }

  /**
   * Clear logout event for a user (after they check it)
   */
  clearLogoutEvent(userId: string): void {
    this.logoutEvents.delete(userId);
    this.logger.log(`[MultiDeviceLogout] 🧹 Cleared logout event for user: ${userId}`);
  }

  /**
   * Get logout event details if exists
   */
  getLogoutEvent(userId: string): LogoutEvent | null {
    return this.logoutEvents.get(userId) || null;
  }

  /**
   * Cleanup old logout events (TTL expired)
   */
  private cleanupOldEvents(): void {
    const now = new Date();
    const expired: string[] = [];

    for (const [userId, event] of this.logoutEvents.entries()) {
      const ageInSeconds = (now.getTime() - event.timestamp.getTime()) / 1000;
      if (ageInSeconds > event.ttl) {
        expired.push(userId);
      }
    }

    expired.forEach(userId => this.logoutEvents.delete(userId));

    if (expired.length > 0) {
      this.logger.debug(
        `[MultiDeviceLogout] 🧹 Cleaned up ${expired.length} expired logout events`
      );
    }
  }

  /**
   * Get all active logout events (for debugging)
   */
  getActiveLogoutEvents(): LogoutEvent[] {
    return Array.from(this.logoutEvents.values());
  }

  /**
   * Get count of active logout events
   */
  getLogoutEventCount(): number {
    return this.logoutEvents.size;
  }
}
