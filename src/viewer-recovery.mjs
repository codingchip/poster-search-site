export const TILE_RETRY_OPTIONS = Object.freeze({
  imageLoaderLimit: 6,
  timeout: 60000,
  tileRetryMax: 3,
  tileRetryDelay: 2000,
});
export const OPEN_RETRY_LIMIT = 3;

export function createOpenRetryController({ reopen, onFailure, schedule = setTimeout, cancel = clearTimeout }) {
  let attempts = 0;
  let timer = null;
  let disposed = false;
  const stopTimer = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };
  return {
    failed() {
      if (disposed) return;
      stopTimer();
      if (attempts >= OPEN_RETRY_LIMIT) {
        onFailure(false, attempts);
        return;
      }
      attempts += 1;
      onFailure(true, attempts);
      timer = schedule(() => {
        timer = null;
        if (!disposed) reopen();
      }, 2000 * 2 ** (attempts - 1));
    },
    succeeded() { stopTimer(); attempts = 0; },
    dispose() { disposed = true; stopTimer(); },
  };
}

export function initialViewerLoadState() {
  return { stage: 'opening', openRetries: 0, failures: new Map() };
}

export function updateViewerLoadState(state, event) {
  switch (event.type) {
    case 'restart': return initialViewerLoadState();
    case 'opened': return { ...state, stage: 'loading', openRetries: 0, failures: new Map() };
    case 'open-failed': return { ...state, stage: event.retry ? 'opening' : 'error', openRetries: event.attempt };
    case 'fully-loaded': {
      const stage = event.loaded ? 'ready' : 'loading';
      return state.stage === stage ? state : { ...state, stage };
    }
    case 'tile-failed': {
      const failures = new Map(state.failures);
      // OSD 6.1 passes 1-based attempt counts: initial download + up to 3 retries.
      failures.set(event.key, Math.max(failures.get(event.key) ?? 0, event.attempts));
      return { ...state, failures };
    }
    case 'tile-loaded': {
      if (!state.failures.has(event.key)) return state;
      const failures = new Map(state.failures);
      failures.delete(event.key);
      return { ...state, failures };
    }
    default: return state;
  }
}

export function viewerLoadSummary(state) {
  if (state.stage === 'error') return { tone: 'error', text: '海报读取失败，请检查网络后手动重试' };
  if (state.stage === 'opening') return {
    tone: state.openRetries ? 'retrying' : 'loading',
    text: state.openRetries
      ? `海报连接失败，正在自动重试 ${state.openRetries}/${OPEN_RETRY_LIMIT}…`
      : '正在连接海报…',
  };
  const exhausted = [...state.failures.values()].filter((attempts) => attempts >= 1 + TILE_RETRY_OPTIONS.tileRetryMax).length;
  const pending = state.failures.size - exhausted;
  if (pending) return {
    tone: 'retrying',
    text: `${pending} 个图块正在自动重试${exhausted ? `，另有 ${exhausted} 个仍失败` : ''}…`,
  };
  if (exhausted) return { tone: 'error', text: `${exhausted} 个图块重试后仍失败，可能显示低清画面` };
  return state.stage === 'ready'
    ? { tone: 'ready', text: '当前视野图块已加载' }
    : { tone: 'loading', text: '当前视野图块加载中，请稍候…' };
}

export function captureViewerView(viewer, selectedSourceIndex) {
  if (!viewer || viewer.world.getItemCount() === 0) return null;
  return { bounds: viewer.viewport.getBounds(true), selectedSourceIndex };
}

export function shouldKeepViewerView(snapshot, selectedSourceIndex) {
  return snapshot !== null && snapshot.selectedSourceIndex === selectedSourceIndex;
}
