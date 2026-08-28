import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('GitHub Pages 构建包含入口和查询数据', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../dist/config/poster.json', import.meta.url), 'utf8'));
  const index = JSON.parse(await readFile(new URL('../dist/data/name-index.json', import.meta.url), 'utf8'));

  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /src="\/src\/main\.tsx"/);
  assert.ok(config.poster.width > 0);
  assert.ok(config.poster.height > 0);
  assert.ok(index.nameCount > 9000);
  assert.equal(index.records.length, index.nameCount);
  const region = config.nameLayerRegion;
  assert.ok(region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0);
  assert.ok(region.x + region.width <= config.poster.width);
  assert.ok(region.y + region.height <= config.poster.height);
  for (const [name, , parts] of index.records) {
    assert.ok(name && parts.length > 0);
    for (const [x, y, width, height] of parts) {
      assert.ok([x, y, width, height].every(Number.isFinite));
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
      assert.ok(x + width <= 1.00001 && y + height <= 1.00001);
    }
  }
});

test('DZI 尺寸与海报配置一致，全部金字塔瓦片完整', async () => {
  const config = JSON.parse(await readFile(new URL('../dist/config/poster.json', import.meta.url), 'utf8'));
  if (config.poster.mode !== 'tiles') return;
  const source = config.poster.tileSourceUrl.replace(/^\/+/, '');
  assert.ok(!source.includes('..'));
  const dziUrl = new URL(`../dist/${source}`, import.meta.url);
  const dzi = await readFile(dziUrl, 'utf8');
  const attribute = (name) => dzi.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  assert.equal(Number(attribute('Width')), config.poster.width);
  assert.equal(Number(attribute('Height')), config.poster.height);
  assert.equal(attribute('Format'), 'png');
  const tileSize = Number(attribute('TileSize'));
  assert.equal(tileSize, 512);
  assert.equal(Number(attribute('Overlap')), 1);
  const maxLevel = Math.ceil(Math.log2(Math.max(config.poster.width, config.poster.height)));
  const tilesUrl = new URL(`../dist/${source.replace(/\.dzi$/, '_files')}/`, import.meta.url);
  let expectedTotal = 0;
  for (let level = 0; level <= maxLevel; level += 1) {
    const factor = 2 ** (maxLevel - level);
    const columns = Math.ceil(Math.ceil(config.poster.width / factor) / tileSize);
    const rows = Math.ceil(Math.ceil(config.poster.height / factor) / tileSize);
    const levelUrl = new URL(`${level}/`, tilesUrl);
    const files = new Set(await readdir(levelUrl));
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const filename = `${column}_${row}.png`;
        assert.ok(files.has(filename), `Missing tile: ${level}/${filename}`);
        assert.ok((await stat(new URL(filename, levelUrl))).size > 0);
        expectedTotal += 1;
      }
    }
    assert.equal(files.size, columns * rows);
  }
  const allFiles = await readdir(tilesUrl, { recursive: true });
  assert.equal(allFiles.filter((name) => path.extname(name) === '.png').length, expectedTotal);
});
