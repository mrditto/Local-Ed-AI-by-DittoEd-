import { spawnSync } from 'node:child_process';
const assets = spawnSync(process.execPath, ['scripts/prepare-ocr-assets.mjs','--offline'], { stdio: 'inherit' });
if (assets.status !== 0) process.exit(assets.status ?? 1);
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner'], { stdio: 'inherit', env: { ...process.env, VITE_INTEGRATED_AI: 'true' } });
if (build.status !== 0) process.exit(build.status ?? 1);
const verification = spawnSync(process.execPath, ['scripts/verify-ocr-assets.mjs'], { stdio: 'inherit' });
process.exit(verification.status ?? 1);
