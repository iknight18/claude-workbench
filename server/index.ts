import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { getDb } from './db/connection';
import { errorHandler } from './shared/middleware/errorHandler';
import promptRoutes from './modules/prompts/routes';
import tagRoutes from './modules/tags/routes';
import sessionRoutes from './modules/sessions/routes';
import filesystemRoutes from './modules/filesystem/routes';
import terminalRoutes from './modules/terminal/routes';
import profileRoutes from './modules/profiles/routes';
import processRoutes from './modules/processes/routes';
import dashboardRoutes from './modules/dashboard/routes';
import schedulerRoutes from './modules/scheduler/routes';
import notificationRoutes from './modules/notifications/routes';
import skillRoutes from './modules/skills/routes';
import { startEngine as startScheduler } from './modules/scheduler/engine';
import { syncProfiles } from './modules/profiles/service';
import { setupWebSockets } from './modules/terminal/websocket';
import { TerminalManager, cleanupOrphanedProcesses } from './modules/terminal/manager';
import { ensureCerts } from './modules/network/config';

const app = express();

// Always create HTTP server
const server = createServer(app);

// In network mode, also create HTTPS for LAN (voice input needs secure context)
let httpsServer: ReturnType<typeof createHttpsServer> | null = null;
if (config.network) {
  const certs = ensureCerts();
  if (certs) {
    httpsServer = createHttpsServer({ key: certs.key, cert: certs.cert }, app);
  }
}

const corsOrigins: string[] = ['http://localhost:4200'];
if (config.network && config.lanIp) {
  corsOrigins.push(`http://${config.lanIp}:4200`);
  corsOrigins.push(`https://${config.lanIp}:4200`);
}
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  const ts = new Date().toISOString().slice(11, 19);
  const body = req.method === 'POST' || req.method === 'PUT'
    ? ` ${JSON.stringify(req.body).slice(0, 500)}`
    : '';
  console.log(`\x1b[36m${ts}\x1b[0m \x1b[33m${req.method}\x1b[0m ${req.path}${body}`);
  next();
});

// Initialize database
getDb();

// Sync discovered profiles into DB
syncProfiles();

// Clean up orphaned Claude processes from previous server runs
cleanupOrphanedProcesses();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ data: {
    status: 'ok',
    isDocker: config.isDocker,
    workspaceHostPath: config.workspaceHostPath,
  } });
});

// Module routes
app.use('/api/prompts', promptRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/filesystem', filesystemRoutes);
app.use('/api/terminals', terminalRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/skills', skillRoutes);

app.use(errorHandler);

// WebSocket for terminal I/O and notifications
setupWebSockets(server);
if (httpsServer) setupWebSockets(httpsServer);

// Cleanup on shutdown
const cleanup = () => {
  TerminalManager.getInstance().killAll();
  process.exit(0);
};
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

const host = (config.network || config.isDocker) ? '0.0.0.0' : 'localhost';
server.listen(config.port, host, () => {
  console.log(`Server running on http://${host}:${config.port}`);
  if (config.network && config.lanIp) {
    console.log(`LAN access: http://${config.lanIp}:${config.port}`);
  }
  startScheduler();
});
if (httpsServer) {
  const httpsPort = config.port + 1;
  httpsServer.listen(httpsPort, host, () => {
    console.log(`HTTPS server on https://${host}:${httpsPort}`);
    if (config.lanIp) {
      console.log(`LAN HTTPS: https://${config.lanIp}:${httpsPort}`);
    }
  });
}
