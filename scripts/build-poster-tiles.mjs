import { access, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
const outputName = process.argv[3] ?? '2026';
if (!input || !/^[a-z0-9][a-z0-9-]*$/i.test(outputName)) {
  throw new Error('用法：npm run poster:build -- "海报原图路径" [输出名称，例如 2026-v2]');
}

const sourcePath = path.resolve(input);
const outputBase = path.join(projectRoot, 'public', 'poster', outputName);
for (const output of [`${outputBase}.dzi`, `${outputBase}_files`]) {
  try {
    await access(output);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  throw new Error(`为避免覆盖已有海报，请指定新的输出名称：${output}`);
}

const metadata = await sharp(sourcePath).metadata();
if (metadata.orientation && metadata.orientation !== 1) {
  throw new Error('原图带有旋转方向信息，请先导出方向正确的图片，再设置对应坐标。');
}
console.log(`Input: ${metadata.width} × ${metadata.height}, ${metadata.format}`);
console.log('Generating lossless PNG tiles (512px, 1px overlap)…');
sharp.concurrency(2);
sharp.cache({ memory: 64 });
await mkdir(path.dirname(outputBase), { recursive: true });
await sharp(sourcePath)
  .png({ compressionLevel: 9 })
  .tile({ size: 512, overlap: 1, layout: 'dz', depth: 'onepixel' })
  // libvips strips .dz, then writes <name>.dzi and <name>_files/.
  .toFile(`${outputBase}.dz`);

// This small inspection image stays outside public/ and is not deployed.
const workDirectory = path.join(projectRoot, 'work');
await mkdir(workDirectory, { recursive: true });
await sharp(sourcePath)
  .resize({ width: 1800, withoutEnlargement: true })
  .jpeg({ quality: 90 })
  .toFile(path.join(workDirectory, `${outputName}-preview.jpg`));

const tileDirectory = `${outputBase}_files`;
const files = (await readdir(tileDirectory, { recursive: true }))
  .filter((name) => name.endsWith('.png'));
const sizes = await Promise.all(files.map(async (name) => (await stat(path.join(tileDirectory, name))).size));
console.log(JSON.stringify({
  dzi: `${outputBase}.dzi`,
  width: metadata.width,
  height: metadata.height,
  tileCount: files.length,
  tileBytes: sizes.reduce((sum, size) => sum + size, 0),
  largestTileBytes: Math.max(...sizes),
}, null, 2));
