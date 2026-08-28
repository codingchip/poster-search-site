import type { Rect, Viewer } from 'openseadragon';

export const TILE_RETRY_OPTIONS: Readonly<{
  imageLoaderLimit: number; timeout: number; tileRetryMax: number; tileRetryDelay: number;
}>;
export const OPEN_RETRY_LIMIT: number;
export type OpenRetryController = { failed(): void; succeeded(): void; dispose(): void };
export function createOpenRetryController(options: {
  reopen: () => void; onFailure: (retry: boolean, attempt: number) => void;
}): OpenRetryController;
export type ViewerLoadState = {
  stage: 'opening' | 'loading' | 'ready' | 'error';
  openRetries: number;
  failures: Map<string, number>;
};
export type ViewerLoadEvent =
  | { type: 'restart' | 'opened' }
  | { type: 'open-failed'; retry: boolean; attempt: number }
  | { type: 'fully-loaded'; loaded: boolean }
  | { type: 'tile-failed'; key: string; attempts: number }
  | { type: 'tile-loaded'; key: string };
export type ViewerViewSnapshot = { bounds: Rect; selectedSourceIndex: number | null };
export function initialViewerLoadState(): ViewerLoadState;
export function updateViewerLoadState(state: ViewerLoadState, event: ViewerLoadEvent): ViewerLoadState;
export function viewerLoadSummary(state: ViewerLoadState): {
  tone: 'loading' | 'retrying' | 'error' | 'ready'; text: string;
};
export function captureViewerView(viewer: Viewer | null, selectedSourceIndex: number | null): ViewerViewSnapshot | null;
export function shouldKeepViewerView(snapshot: ViewerViewSnapshot | null, selectedSourceIndex: number | null): boolean;
