import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class SseService {
  private connections = new Map<string, Response[]>();

  /**
   * Thêm kết nối SSE cho user
   */
  addConnection(userId: string, res: Response) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }
    this.connections.get(userId)!.push(res);
    console.log(`[SSE] User ${userId} connected. Total: ${this.connections.get(userId)!.length}`);
  }

  /**
   * Xóa kết nối SSE khi user disconnect
   */
  removeConnection(userId: string, res: Response) {
    const userConns = this.connections.get(userId);
    if (!userConns) return;

    const index = userConns.indexOf(res);
    if (index > -1) {
      userConns.splice(index, 1);
    }

    if (userConns.length === 0) {
      this.connections.delete(userId);
    }

    console.log(`[SSE] User ${userId} disconnected. Remaining: ${userConns.length}`);
  }

  /**
   * Broadcast event đến tất cả kết nối của user
   */
  broadcast(userId: string, event: any) {
    const userConns = this.connections.get(userId);

    if (!userConns || userConns.length === 0) {
      console.log(`[SSE] No connections for user ${userId}`);
      return;
    }

    const eventType = event.type || 'message';
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`;

    let successCount = 0;

    userConns.forEach((res, index) => {
      try {
        res.write(payload);
        successCount++;
      } catch (err) {
        console.error(`[SSE] Failed to write to connection ${index}:`, err);
        this.removeConnection(userId, res);
      }
    });

    console.log(`[SSE] Broadcasted to ${successCount}/${userConns.length} connections for user ${userId}`);
  }

  /**
   * Lấy số lượng kết nối hiện tại
   */
  getConnectionCount(userId?: string): number {
    if (userId) {
      return this.connections.get(userId)?.length || 0;
    }

    let total = 0;
    this.connections.forEach((conns) => {
      total += conns.length;
    });
    return total;
  }
}
