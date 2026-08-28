import type OpenSeadragonTypes from 'openseadragon';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getNameSourceBounds, projectNamePart } from '../src/name-coordinates.mjs';

type NamePart = [x: number, y: number, width: number, height: number];
type NameRecord = [name: string, sourceIndex: number, parts: NamePart[]];

type NameIndex = {
  version: number;
  target: string;
  sourceWidth: number;
  sourceHeight: number;
  nameCount: number;
  records: NameRecord[];
};

type PosterConfig = {
  version: number;
  title: string;
  poster: {
    mode: 'placeholder' | 'image' | 'tiles';
    imageUrl: string;
    tileSourceUrl: string;
    width: number;
    height: number;
  };
  nameLayerCoordinateMode?: 'canvas' | 'content';
  nameLayerRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

function assetUrl(path: string) {
  if (!path || /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

function createPlaceholderPoster() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 400;
  const context = canvas.getContext('2d');
  if (!context) return '';

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#efe8da');
  gradient.addColorStop(1, '#ddd3c1');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = 'rgba(24, 33, 31, .08)';
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.textAlign = 'center';
  context.fillStyle = '#19211f';
  context.font = '900 54px "Microsoft YaHei", sans-serif';
  context.fillText('正式海报待替换', canvas.width / 2, canvas.height / 2 - 8);
  context.fillStyle = 'rgba(25, 33, 31, .58)';
  context.font = '500 22px "Microsoft YaHei", sans-serif';
  context.fillText('现在可以搜索姓名，验证坐标定位与缩放交互', canvas.width / 2, canvas.height / 2 + 42);
  return canvas.toDataURL('image/png');
}

export default function NameFinder() {
  const viewerElement = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragonTypes.Viewer | null>(null);
  const [config, setConfig] = useState<PosterConfig | null>(null);
  const [nameIndex, setNameIndex] = useState<NameIndex | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(assetUrl('config/poster.json'), { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('海报配置读取失败');
        return response.json() as Promise<PosterConfig>;
      }),
      fetch(assetUrl('data/name-index.json')).then((response) => {
        if (!response.ok) throw new Error('姓名索引读取失败');
        return response.json() as Promise<NameIndex>;
      }),
    ]).then(([nextConfig, nextIndex]) => {
      if (cancelled) return;
      getNameSourceBounds(nextIndex.records, nextConfig.nameLayerCoordinateMode);
      setConfig(nextConfig);
      setNameIndex(nextIndex);
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : '查询数据加载失败');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config || !viewerElement.current) return;
    let cancelled = false;
    let instance: OpenSeadragonTypes.Viewer | null = null;
    void import('openseadragon').then(({ default: OpenSeadragon }) => {
      if (cancelled || !viewerElement.current) return;
      const tileSources = config.poster.mode === 'tiles' && config.poster.tileSourceUrl
        ? assetUrl(config.poster.tileSourceUrl)
        : {
            type: 'image',
            url: config.poster.mode === 'image' && config.poster.imageUrl
              ? assetUrl(config.poster.imageUrl)
              : createPlaceholderPoster(),
          };

      instance = OpenSeadragon({
        element: viewerElement.current,
        tileSources,
        showNavigationControl: false,
        animationTime: 0.65,
        blendTime: 0.1,
        maxZoomPixelRatio: 12,
        visibilityRatio: 0.25,
        constrainDuringPan: true,
        gestureSettingsTouch: {
          dragToPan: true,
          pinchToZoom: true,
          flickEnabled: true,
          clickToZoom: false,
          dblClickToZoom: true,
        },
        gestureSettingsMouse: {
          dragToPan: true,
          scrollToZoom: true,
          clickToZoom: false,
          dblClickToZoom: true,
        },
      });

      viewer.current = instance;
      instance.addHandler('open', () => setViewerReady(true));
    }).catch(() => setLoadError('海报查看器加载失败'));
    return () => {
      cancelled = true;
      setViewerReady(false);
      instance?.destroy();
      viewer.current = null;
    };
  }, [config]);

  const matches = useMemo(() => {
    if (!nameIndex || !deferredQuery) return [];
    const found = nameIndex.records.filter(([name]) => name.includes(deferredQuery));
    return found.sort((a, b) => {
      const aExact = a[0] === deferredQuery ? 0 : 1;
      const bExact = b[0] === deferredQuery ? 0 : 1;
      return aExact - bExact || a[1] - b[1];
    });
  }, [nameIndex, deferredQuery]);

  const selected = matches[Math.min(selectedIndex, Math.max(0, matches.length - 1))] ?? null;

  const sourceBounds = useMemo(() => {
    if (!config || !nameIndex) return null;
    return getNameSourceBounds(nameIndex.records, config.nameLayerCoordinateMode);
  }, [config, nameIndex]);

  const revealRecord = useCallback((record: NameRecord | null) => {
    const instance = viewer.current;
    if (!record || !config || !sourceBounds || !instance || instance.world.getItemCount() === 0) return;
    const image = instance.world.getItemAt(0);
    const contentSize = image.getContentSize();
    const region = config.nameLayerRegion;
    const scaleX = contentSize.x / config.poster.width;
    const scaleY = contentSize.y / config.poster.height;
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    instance.clearOverlays();
    record[2].forEach((part, partIndex) => {
      const mapped = projectNamePart(part, region, sourceBounds);
      const posterX = mapped.x;
      const posterY = mapped.y;
      const posterWidth = mapped.width;
      const posterHeight = mapped.height;
      left = Math.min(left, posterX);
      top = Math.min(top, posterY);
      right = Math.max(right, posterX + posterWidth);
      bottom = Math.max(bottom, posterY + posterHeight);

      const marker = document.createElement('div');
      marker.className = 'name-marker';
      marker.dataset.part = String(partIndex + 1);
      const label = document.createElement('span');
      label.textContent = record[0];
      marker.appendChild(label);
      instance.addOverlay({
        element: marker,
        location: image.imageToViewportRectangle(
          posterX * scaleX,
          posterY * scaleY,
          Math.max(1, posterWidth * scaleX),
          Math.max(1, posterHeight * scaleY),
        ),
        checkResize: false,
      });
    });

    const padX = Math.max((right - left) * 2.8, config.poster.width * 0.008);
    const padY = Math.max((bottom - top) * 7, config.poster.height * 0.025);
    const focus = image.imageToViewportRectangle(
      Math.max(0, left - padX) * scaleX,
      Math.max(0, top - padY) * scaleY,
      Math.min(config.poster.width, right - left + padX * 2) * scaleX,
      Math.min(config.poster.height, bottom - top + padY * 2) * scaleY,
    );
    instance.viewport.fitBoundsWithConstraints(focus, false);
  }, [config, sourceBounds]);

  useEffect(() => {
    if (!viewerReady) return;
    const frame = requestAnimationFrame(() => revealRecord(selected));
    return () => cancelAnimationFrame(frame);
  }, [selected, revealRecord, viewerReady]);

  const zoomBy = (factor: number) => {
    const viewport = viewer.current?.viewport;
    if (!viewport) return;
    viewport.zoomBy(factor);
    viewport.applyConstraints();
  };

  const resetView = () => viewer.current?.viewport.goHome(false);
  const moveSelection = (step: number) => {
    if (!matches.length) return;
    setSelectedIndex((current) => (current + step + matches.length) % matches.length);
  };

  const dataStatus = loadError
    ? loadError
    : nameIndex
      ? `${nameIndex.nameCount.toLocaleString('zh-CN')} 个姓名可查询`
      : '正在载入姓名索引…';

  return (
    <main className="finder-page">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">名</div>
        <div className="brand-copy">
          <p>2026 NEW STUDENTS</p>
          <h1>在欢迎海报里找到我</h1>
        </div>
        <span className={`data-state ${loadError ? 'error' : ''}`}>{nameIndex ? '已就绪' : '载入中'}</span>
      </header>

      <section className="search-section" aria-label="姓名查询">
        <form className="search-box" onSubmit={(event) => { event.preventDefault(); setShowResults(false); revealRecord(selected); }}>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value.replace(/\s+/g, '')); setSelectedIndex(0); setShowResults(true); }}
            onFocus={() => { if (query) setShowResults(true); }}
            placeholder="输入姓名或其中的关键字"
            aria-label="输入姓名或关键字"
            autoComplete="off"
            disabled={!nameIndex}
          />
          {query && <button type="button" className="clear-button" onClick={() => { setQuery(''); setSelectedIndex(0); setShowResults(false); viewer.current?.clearOverlays(); }} aria-label="清空搜索">×</button>}
          <button className="search-button" type="submit" disabled={!selected}>定位</button>
        </form>

        <div className="search-meta" aria-live="polite">
          <span>{deferredQuery ? matches.length ? `找到 ${matches.length} 个匹配` : '没有找到匹配姓名' : dataStatus}</span>
          <span>支持姓名连续关键字</span>
        </div>

        {showResults && deferredQuery && matches.length > 0 && (
          <div className="result-list" aria-label="查询结果">
            {matches.slice(0, 8).map((record, index) => (
              <button
                type="button"
                key={`${record[1]}-${record[0]}`}
                className={index === selectedIndex ? 'active' : ''}
                onClick={() => { setSelectedIndex(index); setShowResults(false); }}
              >
                <strong>{record[0]}</strong>
                <small>名单第 {record[1] + 1} 位</small>
              </button>
            ))}
            {matches.length > 8 && <span className="more-results">另有 {matches.length - 8} 个，可用下方箭头逐个查看</span>}
          </div>
        )}
      </section>

      <section className="poster-card" aria-label="海报查看区域">
        <div className="poster-toolbar">
          <div>
            <p>{config?.title ?? '新生姓名海报'}</p>
            <span>{config?.poster.mode === 'placeholder' ? '海报待设计 · 坐标验证模式' : '拖动或双指缩放查看'}</span>
          </div>
          <div className="zoom-controls" aria-label="海报缩放控制">
            <button type="button" onClick={() => zoomBy(1 / 1.5)} aria-label="缩小海报">−</button>
            <button type="button" onClick={resetView} aria-label="显示完整海报">全图</button>
            <button type="button" onClick={() => zoomBy(1.5)} aria-label="放大海报">＋</button>
          </div>
        </div>

        <div className="viewer-wrap">
          <div ref={viewerElement} className="poster-viewer" />
          {!viewerReady && <div className="viewer-loading">正在准备海报查看器…</div>}
          <div className="gesture-tip">单指拖动 · 双指缩放 · 双击放大</div>
        </div>

        <div className={`selection-bar ${selected ? 'visible' : ''}`} aria-live="polite">
          <button type="button" onClick={() => moveSelection(-1)} disabled={!selected} aria-label="上一个匹配姓名">‹</button>
          <div>
            <span>{selected ? `${selectedIndex + 1} / ${matches.length}` : '等待查询'}</span>
            <strong>{selected?.[0] ?? '输入姓名后自动定位'}</strong>
            <small>{selected ? `已框选 ${selected[2].length} 个位置` : '搜索结果会在海报中高亮显示'}</small>
          </div>
          <button type="button" onClick={() => moveSelection(1)} disabled={!selected} aria-label="下一个匹配姓名">›</button>
        </div>
      </section>

      <footer className="page-footer">
        <span>姓名查询仅用于新生海报定位</span>
        <span>正式上线前请确认姓名信息公开范围</span>
      </footer>
    </main>
  );
}
