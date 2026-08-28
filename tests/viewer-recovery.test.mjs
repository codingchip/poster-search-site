import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureViewerView, createOpenRetryController, initialViewerLoadState,
  shouldKeepViewerView, TILE_RETRY_OPTIONS, updateViewerLoadState, viewerLoadSummary,
} from '../src/viewer-recovery.mjs';

test('瓦片下载限制并发，超时60秒，初次请求外最多重试3次', () => {
  assert.deepEqual(TILE_RETRY_OPTIONS, {
    imageLoaderLimit: 6, timeout: 60000, tileRetryMax: 3, tileRetryDelay: 2000,
  });
});

test('瓦片失败、自动重试到成功的状态不会残留错误', () => {
  let state = updateViewerLoadState(initialViewerLoadState(), { type: 'opened' });
  for (let attempts = 1; attempts <= 3; attempts += 1) {
    state = updateViewerLoadState(state, { type: 'tile-failed', key: '15/5_3', attempts });
    assert.equal(viewerLoadSummary(state).tone, 'retrying');
  }
  state = updateViewerLoadState(state, { type: 'tile-loaded', key: '15/5_3' });
  state = updateViewerLoadState(state, { type: 'fully-loaded', loaded: true });
  assert.equal(state.failures.size, 0);
  assert.equal(viewerLoadSummary(state).tone, 'ready');
});

test('第四次下载失败才耗尽重试；低清层加载完成不掩盖高清层错误', () => {
  let state = updateViewerLoadState(initialViewerLoadState(), { type: 'opened' });
  state = updateViewerLoadState(state, { type: 'tile-failed', key: '15/5_3', attempts: 4 });
  state = updateViewerLoadState(state, { type: 'fully-loaded', loaded: true });
  state = updateViewerLoadState(state, { type: 'tile-loaded', key: '14/2_1' });
  assert.equal(viewerLoadSummary(state).tone, 'error');
  assert.match(viewerLoadSummary(state).text, /1 个图块/);
  // Repeated events count tiles, not attempts.
  state = updateViewerLoadState(state, { type: 'tile-failed', key: '15/5_3', attempts: 4 });
  assert.equal(state.failures.size, 1);
  state = updateViewerLoadState(state, { type: 'restart' });
  assert.equal(state.failures.size, 0);
  assert.equal(state.stage, 'opening');
});

test('部分图块重试、部分耗尽时显示两种状态，成功后移除对应错误', () => {
  let state = updateViewerLoadState(initialViewerLoadState(), { type: 'opened' });
  state = updateViewerLoadState(state, { type: 'tile-failed', key: 'a', attempts: 4 });
  state = updateViewerLoadState(state, { type: 'tile-failed', key: 'b', attempts: 1 });
  assert.match(viewerLoadSummary(state).text, /1 个图块正在自动重试，另有 1 个仍失败/);
  state = updateViewerLoadState(state, { type: 'tile-loaded', key: 'b' });
  assert.equal(viewerLoadSummary(state).tone, 'error');
});

function fakeTimers() {
  const pending = new Map();
  let id = 0;
  return {
    pending,
    schedule(callback, delay) { const key = ++id; pending.set(key, { callback, delay }); return key; },
    cancel(key) { pending.delete(key); },
    runNext() {
      const [key, value] = pending.entries().next().value;
      pending.delete(key); value.callback(); return value.delay;
    },
  };
}

test('DZI打开失败只重试3次，等待时间依次2/4/8秒', () => {
  const timer = fakeTimers();
  const failures = [];
  let opens = 0;
  const controller = createOpenRetryController({
    reopen: () => opens++, onFailure: (retry, attempt) => failures.push({ retry, attempt }),
    schedule: timer.schedule, cancel: timer.cancel,
  });
  for (const delay of [2000, 4000, 8000]) {
    controller.failed();
    assert.equal(timer.pending.size, 1);
    assert.equal(timer.runNext(), delay);
  }
  controller.failed();
  assert.equal(opens, 3);
  assert.equal(timer.pending.size, 0);
  assert.deepEqual(failures.at(-1), { retry: false, attempt: 3 });
});

test('成功或退出查看器会取消待执行重试，旧回调不会重开查看器', () => {
  const timer = fakeTimers();
  let opens = 0;
  const attempts = [];
  const controller = createOpenRetryController({
    reopen: () => opens++, onFailure: (retry, attempt) => attempts.push(attempt),
    schedule: timer.schedule, cancel: timer.cancel,
  });
  controller.failed();
  controller.succeeded();
  assert.equal(timer.pending.size, 0);
  controller.failed();
  assert.deepEqual(attempts, [1, 1]);
  const staleCallback = [...timer.pending.values()][0].callback;
  controller.dispose();
  staleCallback();
  controller.failed();
  assert.equal(timer.pending.size, 0);
  assert.equal(opens, 0);
});

test('手动重试保存当前视野；只有选择未变时才恢复而不重新定位', () => {
  const bounds = { x: 0.3, y: 0.2, width: 0.05, height: 0.08 };
  const viewer = { world: { getItemCount: () => 1 }, viewport: { getBounds: (current) => {
    assert.equal(current, true); return bounds;
  } } };
  const snapshot = captureViewerView(viewer, 42);
  assert.deepEqual(snapshot, { bounds, selectedSourceIndex: 42 });
  assert.equal(shouldKeepViewerView(snapshot, 42), true);
  assert.equal(shouldKeepViewerView(snapshot, 43), false);
  assert.equal(shouldKeepViewerView(null, 42), false);
  assert.equal(captureViewerView(null, 42), null);
  assert.equal(captureViewerView({ world: { getItemCount: () => 0 } }, null), null);
});
