import type { AniListMedia, AnimeNodeData, UserMediaListEntry, WatchStatus } from '../types/anime';
import type { RawEdge } from '../api/crawler';
import type { SuiteMode } from '../types/media';

export interface WatchOrderResolution {
  enhancedMediaMap: Map<number, AnimeNodeData>;
  nextUpIds: Set<number>;
  totalCompleted: number;
  totalInTimeline: number;
}

export function resolveWatchOrder(
  mediaMap: Map<number, AniListMedia>,
  rawEdges: RawEdge[],
  userEntries: Map<number, UserMediaListEntry> | null,
  suiteMode: SuiteMode = 'anime'
): WatchOrderResolution {
  const enhancedMap = new Map<number, AnimeNodeData>();

  if (suiteMode !== 'anime') {
    mediaMap.forEach((media, id) => {
      enhancedMap.set(id, {
        ...media,
        suiteMode,
        isNextUp: false,
      });
    });

    return {
      enhancedMediaMap: enhancedMap,
      nextUpIds: new Set<number>(),
      totalCompleted: 0,
      totalInTimeline: mediaMap.size,
    };
  }

  let totalCompleted = 0;
  const totalInTimeline = mediaMap.size;

  const prereqMap = new Map<number, Array<{ source: number; type: string }>>();
  const outgoingMap = new Map<number, Array<{ target: number; type: string }>>();

  for (const edge of rawEdges) {
    if (!prereqMap.has(edge.target)) {
      prereqMap.set(edge.target, []);
    }
    prereqMap.get(edge.target)!.push({ source: edge.source, type: edge.type });

    if (!outgoingMap.has(edge.source)) {
      outgoingMap.set(edge.source, []);
    }
    outgoingMap.get(edge.source)!.push({ target: edge.target, type: edge.type });
  }

  mediaMap.forEach((media, id) => {
    let watchStatus: WatchStatus = 'UNWATCHED';
    let userProgress: number | undefined;
    let userScore: number | undefined;

    if (userEntries && userEntries.has(id)) {
      const entry = userEntries.get(id)!;
      watchStatus = entry.status as WatchStatus;
      userProgress = entry.progress;
      userScore = entry.score;
    }

    if (watchStatus === 'COMPLETED') {
      totalCompleted++;
    }

    enhancedMap.set(id, {
      ...media,
      watchStatus,
      userProgress,
      userScore,
      isNextUp: false,
    });
  });

  const nextUpIds = new Set<number>();

  if (totalCompleted === 0) {
    const incomingSequelCounts = new Map<number, number>();
    mediaMap.forEach((_, id) => incomingSequelCounts.set(id, 0));

    rawEdges.forEach((edge) => {
      if (edge.type === 'SEQUEL') {
        incomingSequelCounts.set(edge.target, (incomingSequelCounts.get(edge.target) || 0) + 1);
      }
    });

    let bestRootId: number | null = null;
    let earliestYear = 9999;

    mediaMap.forEach((media, id) => {
      const incoming = incomingSequelCounts.get(id) || 0;
      if (incoming === 0) {
        const year = media.seasonYear || 9999;
        const isTv = media.format === 'TV';
        if (bestRootId === null || (isTv && year <= earliestYear) || year < earliestYear) {
          bestRootId = id;
          earliestYear = year;
        }
      }
    });

    if (bestRootId !== null) {
      nextUpIds.add(bestRootId);
      const node = enhancedMap.get(bestRootId);
      if (node && node.watchStatus !== 'CURRENT') {
        node.isNextUp = true;
      }
    }
  } else {
    mediaMap.forEach((_, id) => {
      const node = enhancedMap.get(id);
      if (node?.watchStatus === 'COMPLETED') {
        const outgoing = outgoingMap.get(id) || [];
        for (const out of outgoing) {
          const downstreamNode = enhancedMap.get(out.target);
          if (
            downstreamNode &&
            downstreamNode.watchStatus !== 'COMPLETED' &&
            downstreamNode.watchStatus !== 'CURRENT'
          ) {
            const prereqs = prereqMap.get(out.target) || [];
            const sequelPrereqs = prereqs.filter((p) => p.type === 'SEQUEL');
            const allSequelsWatched = sequelPrereqs.every(
              (p) => enhancedMap.get(p.source)?.watchStatus === 'COMPLETED'
            );

            if (allSequelsWatched) {
              nextUpIds.add(out.target);
            }
          }
        }
      }
    });

    nextUpIds.forEach((id) => {
      const node = enhancedMap.get(id);
      if (node) {
        node.isNextUp = true;
      }
    });
  }

  return {
    enhancedMediaMap: enhancedMap,
    nextUpIds,
    totalCompleted,
    totalInTimeline,
  };
}
