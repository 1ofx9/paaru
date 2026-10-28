import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { crawlTimeline } from '../api/crawler';
import type { RawEdge } from '../api/crawler';
import { crawlTMDBMovieCollection, crawlTMDBTVUniverse } from '../api/tmdbCrawler';
import { resolveWatchOrder } from '../utils/watchOrder';
import { buildDagreLayout } from '../utils/layout';
import type {
  AniListMedia,
  AnimeNodeData,
  TimelineStats,
  GraphFilterOptions,
  UserMediaListEntry,
  ViewMode,
} from '../types/anime';
import type { SuiteMode } from '../types/media';
import type { Edge, Node } from '@xyflow/react';

export function useTimeline(
  userEntries: Map<number, UserMediaListEntry> | null,
  filters: GraphFilterOptions,
  viewMode: ViewMode = 'detailed',
  theme: 'dark' | 'light' = 'dark',
  suiteMode: SuiteMode = 'anime'
) {
  const [rootMediaId, setRootMediaId] = useState<number | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    return idParam ? parseInt(idParam, 10) : null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{
    loaded: number;
    total: number;
    currentTitle: string;
    rateLimitSeconds?: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mediaMap, setMediaMap] = useState<Map<number, AniListMedia>>(new Map());
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [activeTimelineMode, setActiveTimelineMode] = useState<SuiteMode>(suiteMode);
  const activeCrawlIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setActiveTimelineMode(suiteMode);
  }, [suiteMode]);

  const loadTimeline = useCallback(async (id: number, overrideMode?: SuiteMode) => {
    const currentMode = overrideMode || suiteMode;
    setActiveTimelineMode(currentMode);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const crawlId = ++activeCrawlIdRef.current;
    setIsLoading(true);
    setError(null);
    setProgress({ loaded: 1, total: 1, currentTitle: 'Connecting...' });
    setRootMediaId(id);
    setMediaMap(new Map());
    setRawEdges([]);

    const url = new URL(window.location.href);
    url.searchParams.set('id', id.toString());
    url.searchParams.set('mode', currentMode);
    window.history.replaceState({}, '', url.toString());

    try {
      if (currentMode === 'movies') {
        const result = await crawlTMDBMovieCollection(
          id,
          (loaded, total, title) => {
            if (activeCrawlIdRef.current !== crawlId || controller.signal.aborted) return;
            setProgress({
              loaded,
              total,
              currentTitle: title ?? 'Loading movie...',
            });
          },
          controller.signal
        );
        if (activeCrawlIdRef.current !== crawlId || controller.signal.aborted) return;
        setMediaMap(result.mediaMap);
        setRawEdges(result.rawEdges);
      } else if (currentMode === 'shows') {
        const result = await crawlTMDBTVUniverse(
          id,
          (loaded, total, title) => {
            if (activeCrawlIdRef.current !== crawlId || controller.signal.aborted) return;
            setProgress({
              loaded,
              total,
              currentTitle: title ?? 'Loading series...',
            });
          },
          controller.signal
        );
        if (activeCrawlIdRef.current !== crawlId || controller.signal.aborted) return;
        setMediaMap(result.mediaMap);
        setRawEdges(result.rawEdges);
      } else {
        const result = await crawlTimeline(
          id,
          (loaded, total, title, _currentMediaMap, _currentRawEdges, rateLimitSeconds) => {
            if (activeCrawlIdRef.current !== crawlId || controller.signal.aborted) return;
            setProgress((prev) => ({
              loaded,
              total,
              currentTitle: title ?? prev?.currentTitle ?? 'Loading node...',
              rateLimitSeconds: rateLimitSeconds ?? null,
            }));
          },
          60,
          controller.signal
        );
        if (activeCrawlIdRef.current !== crawlId || controller.signal.aborted) return;
        setMediaMap(result.mediaMap);
        setRawEdges(result.rawEdges);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (activeCrawlIdRef.current === crawlId) {
        console.error('Failed to crawl timeline data:', err);
        setError(err?.message || 'Failed to load timeline graph');
      }
    } finally {
      if (activeCrawlIdRef.current === crawlId && !controller.signal.aborted) {
        setIsLoading(false);
        setProgress(null);
      }
    }
  }, [suiteMode]);

  const clearTimeline = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeCrawlIdRef.current++;
    setIsLoading(false);
    setProgress(null);
    setRootMediaId(null);
    setMediaMap(new Map());
    setRawEdges([]);
    setSelectedMediaId(null);
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.replaceState({}, '', url.toString());
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (rootMediaId) {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode') as SuiteMode | null;
      loadTimeline(rootMediaId, modeParam || suiteMode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const watchOrderData = useMemo(() => {
    if (mediaMap.size === 0) {
      return {
        enhancedMediaMap: new Map<number, AnimeNodeData>(),
        nextUpIds: new Set<number>(),
        totalCompleted: 0,
        totalInTimeline: 0,
      };
    }
    return resolveWatchOrder(mediaMap, rawEdges, userEntries, activeTimelineMode, rootMediaId);
  }, [mediaMap, rawEdges, userEntries, activeTimelineMode, rootMediaId]);

  const layout = useMemo(() => {
    if (watchOrderData.enhancedMediaMap.size === 0) {
      return { nodes: [] as Node<AnimeNodeData>[], edges: [] as Edge[] };
    }
    return buildDagreLayout(
      watchOrderData.enhancedMediaMap,
      rawEdges,
      filters,
      viewMode,
      theme,
      activeTimelineMode,
      rootMediaId
    );
  }, [watchOrderData.enhancedMediaMap, rawEdges, filters, viewMode, theme, activeTimelineMode, rootMediaId]);

  const timelineStats = useMemo<TimelineStats | null>(() => {
    if (mediaMap.size === 0) return null;
    let totalEntries = 0;
    let completedEntries = 0;
    let totalEpisodes = 0;
    let watchedEpisodes = 0;
    let remainingMinutes = 0;

    watchOrderData.enhancedMediaMap.forEach((media) => {
      totalEntries++;
      const eps = media.episodes && media.episodes > 0 ? media.episodes : 1;
      totalEpisodes += eps;

      const duration = media.duration && media.duration > 0 ? media.duration : 24;

      if (media.watchStatus === 'COMPLETED') {
        completedEntries++;
        watchedEpisodes += eps;
      } else if (media.watchStatus === 'CURRENT') {
        const prog = Math.min(media.userProgress || 0, eps);
        watchedEpisodes += prog;
        const remainingInMedia = Math.max(0, eps - prog);
        remainingMinutes += remainingInMedia * duration;
      } else {
        remainingMinutes += eps * duration;
      }
    });

    const remainingEpisodes = Math.max(0, totalEpisodes - watchedEpisodes);
    const remainingHours = Math.round((remainingMinutes / 60) * 10) / 10;
    const percentComplete = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;

    return {
      totalEntries,
      completedEntries,
      totalEpisodes,
      watchedEpisodes,
      remainingEpisodes,
      remainingHours,
      percentComplete,
    };
  }, [mediaMap.size, watchOrderData.enhancedMediaMap]);

  const selectedMedia = useMemo(() => {
    if (!selectedMediaId) return null;
    return watchOrderData.enhancedMediaMap.get(selectedMediaId) || null;
  }, [selectedMediaId, watchOrderData.enhancedMediaMap]);

  return {
    rootMediaId,
    isLoading,
    progress,
    error,
    nodes: layout.nodes,
    edges: layout.edges,
    timelineStats,
    selectedMediaId,
    selectedMedia,
    loadTimeline,
    clearTimeline,
    setSelectedMediaId,
  };
}
