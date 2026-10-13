import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { read } = await import(pathToFileURL(require.resolve('image-js', {
  paths: [path.dirname(require.resolve('@choochmeque/tauri-windows-bundle'))],
})).href);
const assets = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'src-tauri/gen/windows/Assets');
for (const [name, width, height] of [
  ['StoreLogo.png', 50, 50], ['Square44x44Logo.png', 44, 44],
  ['Square150x150Logo.png', 150, 150], ['Wide310x150Logo.png', 310, 150],
]) {
  const image = await read(path.join(assets, name));
  if (image.width !== width || image.height !== height) throw new Error(`${name}: incorrect dimensions`);
  const colors = new Set(); let visible = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = image.getPixel(x, y);
    if (pixel.length === 4 && pixel[3] === 0) continue;
    visible++; colors.add(pixel.slice(0, 3).join(','));
  }
  if (visible < width * height * 0.1 || colors.size < 32)
    throw new Error(`${name}: blank or solid placeholder tile`);
  console.log(`Verified branded tile ${name}: ${width}x${height}, ${colors.size} visible colors`);
}
