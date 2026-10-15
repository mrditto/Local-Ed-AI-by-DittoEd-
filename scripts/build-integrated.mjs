import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner'], { stdio: 'inherit', env: { ...process.env, VITE_INTEGRATED_AI: 'true' } });
process.exit(build.status ?? 1);
