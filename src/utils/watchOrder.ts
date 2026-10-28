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
  suiteMode: SuiteMode = 'anime',
  rootMediaId?: number | null
): WatchOrderResolution {
  const enhancedMap = new Map<number, AnimeNodeData>();

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

    if (suiteMode === 'anime' && userEntries && userEntries.has(id)) {
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
      suiteMode,
      watchStatus,
      userProgress,
      userScore,
      isNextUp: false,
    });
  });

  const nextUpIds = new Set<number>();

  if (totalCompleted === 0) {
    let startingId: number | null = null;

    // If a searched root exists in the timeline, trace back to its earliest true TV/Movie prequel
    if (rootMediaId && mediaMap.has(rootMediaId)) {
      let curr = rootMediaId;
      const visitedBack = new Set<number>([curr]);
      while (true) {
        const currMedia = mediaMap.get(curr);
        const currYear = currMedia?.seasonYear || (currMedia as any)?.startDate?.year || 9999;
        const inSequels = (prereqMap.get(curr) || []).filter(
          (p) => p.type === 'SEQUEL' && !visitedBack.has(p.source)
        );
        const earlierPred = inSequels.find((p) => {
          const pMedia = mediaMap.get(p.source);
          const pYear = pMedia?.seasonYear || (pMedia as any)?.startDate?.year || 9999;
          return pYear <= currYear && (pMedia?.format === 'TV' || pMedia?.format === 'MOVIE');
        });
        if (earlierPred) {
          visitedBack.add(earlierPred.source);
          curr = earlierPred.source;
        } else {
          break;
        }
      }
      startingId = curr;
    }

    if (!startingId) {
      const incomingSequelCounts = new Map<number, number>();
      mediaMap.forEach((_, id) => incomingSequelCounts.set(id, 0));

      rawEdges.forEach((edge) => {
        if (edge.type === 'SEQUEL') {
          incomingSequelCounts.set(edge.target, (incomingSequelCounts.get(edge.target) || 0) + 1);
        }
      });

      const candidates = Array.from(mediaMap.values()).filter(
        (m) => (incomingSequelCounts.get(m.id) || 0) === 0
      );

      const tvCandidates = candidates.filter((m) => m.format === 'TV');
      const movieCandidates = candidates.filter((m) => m.format === 'MOVIE');
      const eligible =
        tvCandidates.length > 0
          ? tvCandidates
          : movieCandidates.length > 0
          ? movieCandidates
          : candidates;

      eligible.sort((a, b) => {
        const yA = a.seasonYear || (a as any).startDate?.year || 9999;
        const yB = b.seasonYear || (b as any).startDate?.year || 9999;
        return yA - yB;
      });

      if (eligible.length > 0) {
        startingId = eligible[0].id;
      }
    }

    if (startingId !== null) {
      nextUpIds.add(startingId);
      const node = enhancedMap.get(startingId);
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
