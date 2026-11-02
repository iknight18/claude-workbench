import { WebSocket } from 'ws';
import { Notification } from './types';

class NotificationBroadcaster {
  private static instance: NotificationBroadcaster;
  private clients: Set<WebSocket> = new Set();

  static getInstance(): NotificationBroadcaster {
    if (!NotificationBroadcaster.instance) {
      NotificationBroadcaster.instance = new NotificationBroadcaster();
    }
    return NotificationBroadcaster.instance;
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  broadcast(notification: Notification): void {
    const message = JSON.stringify({ type: 'notification', data: notification });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  broadcastEvent(event: { type: string; [key: string]: any }): void {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export { NotificationBroadcaster };
