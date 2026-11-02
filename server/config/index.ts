import path from 'path';
import { homedir } from 'os';
import { getLanIp } from '../modules/network/config';

const network = process.env.NETWORK === 'true';
const lanIp = network ? getLanIp() : null;
const dataDir = process.env.DATA_DIR || null;

export const config = {
  port: 4201,
  corsOrigin: 'http://localhost:4200',
  dbPath: dataDir
    ? path.join(dataDir, 'db', 'ai-os.db')
    : path.join(__dirname, '..', 'data', 'ai-os.db'),
  profilesDir: dataDir
    ? path.join(dataDir, 'profiles')
    : homedir(),
  debugDir: dataDir
    ? path.join(dataDir, 'debug')
    : path.join(__dirname, '..', 'data', 'debug'),
  isDocker: !!dataDir,
  network,
  lanIp,
  workspaceHostPath: process.env.WORKSPACE_HOST_PATH || null,
  profilesHostPath: process.env.PROFILES_HOST_PATH || null,
};
