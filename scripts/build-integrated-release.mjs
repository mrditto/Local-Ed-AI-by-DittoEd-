import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const production = process.argv.includes('--production');
// Fresh CI workers may fetch dependencies while retaining the lockfile.
// Local builds remain offline unless explicitly requested otherwise.
const cargoArgs = process.argv.includes('--online') ? ['--locked'] : ['--offline', '--locked'];
const config = production ? 'src-tauri/tauri.store-integrated.conf.json' : 'src-tauri/tauri.integrated.conf.json';
const identifier = production ? 'com.educatorllm.app' : 'com.dittoed.localai.integrated.dev';
const result = spawnSync(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js','build','--config',config,'--features','integrated-only','--no-bundle','--ci','--',...cargoArgs], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const binary = fs.readFileSync('src-tauri/target/release/educatorllm.exe');
fs.mkdirSync('local-ai-data', { recursive: true });
fs.writeFileSync('local-ai-data/integrated-build.json', JSON.stringify({ sha256: crypto.createHash('sha256').update(binary).digest('hex'), builtAt: new Date().toISOString(), identifier, integratedOnly: true }, null, 2));
