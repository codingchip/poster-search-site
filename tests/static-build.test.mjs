import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GitHub Pages 构建包含入口和查询数据', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../dist/config/poster.json', import.meta.url), 'utf8'));
  const index = JSON.parse(await readFile(new URL('../dist/data/name-index.json', import.meta.url), 'utf8'));

  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /src="\/src\/main\.tsx"/);
  assert.equal(config.poster.width, 3600);
  assert.ok(index.nameCount > 9000);
  assert.equal(index.records.length, index.nameCount);
});
