import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getNameSourceBounds, projectNamePart } from '../src/name-coordinates.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`);

test('未配置模式时保持原有全画布坐标', () => {
  const bounds = getNameSourceBounds([]);
  assert.deepEqual(bounds, { x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(projectNamePart([0.2, 0.3, 0.1, 0.05], { x: 10, y: 20, width: 100, height: 200 }, bounds), {
    x: 30, y: 80, width: 10, height: 10,
  });
});

test('content 模式去除四周留白，跨行姓名的每段分别映射', () => {
  const records = [['跨行姓名', 0, [[0.2, 0.3, 0.1, 0.05], [0.8, 0.8, 0.1, 0.05]]]];
  const bounds = getNameSourceBounds(records, 'content');
  close(bounds.x, 0.2);
  close(bounds.y, 0.3);
  close(bounds.width, 0.7);
  close(bounds.height, 0.55);
  const destination = { x: 100, y: 200, width: 1400, height: 1100 };
  const first = projectNamePart(records[0][2][0], destination, bounds);
  const second = projectNamePart(records[0][2][1], destination, bounds);
  close(first.x, 100);
  close(first.y, 200);
  close(first.width, 200);
  close(first.height, 100);
  close(second.x + second.width, 1500);
  close(second.y + second.height, 1300);
});

test('无效文字范围或模式不应悄悄返回错误坐标', () => {
  assert.throws(() => getNameSourceBounds([], 'content'));
  assert.throws(() => getNameSourceBounds([], 'unknown'));
});

test('正式海报的全部姓名框整体落在配置的可见文字区域', async () => {
  const config = JSON.parse(await readFile(new URL('../public/config/poster.json', import.meta.url), 'utf8'));
  const index = JSON.parse(await readFile(new URL('../public/data/name-index.json', import.meta.url), 'utf8'));
  assert.equal(config.nameLayerCoordinateMode, 'content');
  const source = getNameSourceBounds(index.records, config.nameLayerCoordinateMode);
  const region = config.nameLayerRegion;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [, , parts] of index.records) {
    for (const part of parts) {
      const box = projectNamePart(part, region, source);
      assert.ok(Object.values(box).every(Number.isFinite));
      left = Math.min(left, box.x);
      top = Math.min(top, box.y);
      right = Math.max(right, box.x + box.width);
      bottom = Math.max(bottom, box.y + box.height);
    }
  }
  close(left, region.x);
  close(top, region.y);
  close(right, region.x + region.width);
  close(bottom, region.y + region.height);
  const first = projectNamePart(index.records[0][2][0], region, source);
  close(first.y, region.y);
  assert.ok(first.x < region.x + index.records[0][2][0][0] * region.width,
    '必须补偿左侧留白，不能沿用全画布公式');
});
