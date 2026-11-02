import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TerminalManager } from './manager';
import { NotificationBroadcaster } from '../notifications/websocket';

export function setupWebSockets(server: HttpServer): void {
  const terminalWss = new WebSocketServer({ noServer: true });
  const notificationWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = request.url || '';

    // Terminal WebSocket
    const terminalMatch = url.match(/^\/api\/terminals\/([^/?]+)/);
    if (terminalMatch) {
      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        handleTerminalConnection(ws, terminalMatch[1]);
      });
      return;
    }

    // Notification WebSocket
    if (url.startsWith('/api/notifications/ws')) {
      notificationWss.handleUpgrade(request, socket, head, (ws) => {
        NotificationBroadcaster.getInstance().addClient(ws);
      });
      return;
    }

    socket.destroy();
  });
}

function handleTerminalConnection(ws: WebSocket, sessionId: string): void {
  const manager = TerminalManager.getInstance();
  const instance = manager.get(sessionId);

  if (!instance) {
    ws.close(4004, 'No terminal running for this session');
    return;
  }

  instance.clients.add(ws);

  // Replay buffered output so reconnecting clients see prior content
  const buffer = manager.getOutputBuffer(sessionId);
  if (buffer) {
    ws.send(JSON.stringify({ type: 'output', data: buffer }));
  }

  if (!instance.alive) {
    ws.send(JSON.stringify({ type: 'exit', code: -1 }));
  }

  ws.on('message', (raw: Buffer | string) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === 'input' && typeof message.data === 'string') {
        manager.write(sessionId, message.data);
      } else if (
        message.type === 'resize' &&
        typeof message.cols === 'number' &&
        typeof message.rows === 'number'
      ) {
        manager.resize(sessionId, message.cols, message.rows);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    instance.clients.delete(ws);
  });
}
