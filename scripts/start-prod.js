const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

console.log('');
console.log('  ==========================================');
console.log('   Claude Workbench — Production');
console.log('  ==========================================');
console.log('');
console.log('  Frontend: http://localhost:4200');
console.log('  Backend:  http://localhost:4201');
console.log('');

// Start the Express server (compiled JS)
const server = spawn(
  process.execPath,
  ['dist/index.js'],
  {
    cwd: path.join(ROOT, 'server'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  }
);

// Start the Next.js standalone server
const client = spawn(
  process.execPath,
  ['server.js'],
  {
    cwd: path.join(ROOT, 'client', '.next', 'standalone', 'client'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT: '4200' },
  }
);

function cleanup() {
  server.kill();
  client.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

server.on('exit', (code) => {
  if (code !== null) {
    console.log(`  [server] exited with code ${code}`);
    client.kill();
    process.exit(code);
  }
});

client.on('exit', (code) => {
  if (code !== null) {
    console.log(`  [client] exited with code ${code}`);
    server.kill();
    process.exit(code);
  }
});
