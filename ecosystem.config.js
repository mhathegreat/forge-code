// PM2 process manager config for KimiStudio
// Backend (Express + WS + agent) on :4000, Frontend (Next.js) on :3001
const NODE = process.env.PM2_NODE || require('child_process').execSync('which node').toString().trim();
const ROOT = '/mnt/data/kimi-projects/_kimistudio';

module.exports = {
  apps: [
    {
      name: 'kimi-backend',
      cwd: ROOT + '/backend',
      script: 'server.js',
      interpreter: NODE,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'kimi-frontend',
      cwd: ROOT + '/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001 -H 0.0.0.0',
      interpreter: NODE,
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
