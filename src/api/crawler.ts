import { fetchAniListMediaBatch } from './anilist';
import type { AniListMedia, RelationType } from '../types/anime';

export interface RawEdge {
  source: number;
  target: number;
  type: RelationType;
}

export interface CrawlResult {
  mediaMap: Map<number, AniListMedia>;
  rawEdges: RawEdge[];
  rootId: number;
}

const ALLOWED_RELATIONS: RelationType[] = [
  'SEQUEL',
  'PREQUEL',
  'SIDE_STORY',
  'SPIN_OFF',
  'ALTERNATIVE',
  'PARENT',
];

const DISALLOWED_FORMATS = ['MUSIC'];

export type CrawlProgressCallback = (
  loaded: number,
  totalQueued: number,
  currentTitle?: string,
  mediaMap?: Map<number, AniListMedia>,
  rawEdges?: RawEdge[],
  rateLimitSeconds?: number | null
) => void;

export async function crawlTimeline(
  rootMediaId: number,
  onProgress?: CrawlProgressCallback,
  maxNodes = 60,
  signal?: AbortSignal
): Promise<CrawlResult> {
  const visited = new Set<number>();
  const queuedSet = new Set<number>([rootMediaId]);
  const queue: number[] = [rootMediaId];
  const mediaMap = new Map<number, AniListMedia>();
  const rawEdges: RawEdge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(source: number, target: number, type: RelationType) {
    if (source === target) return;
    const key = `${source}->${target}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      rawEdges.push({ source, target, type });
    }
  }

  const BATCH_SIZE = 15;

  while (queue.length > 0 && visited.size < maxNodes) {
    if (signal?.aborted) break;

    const batchIds: number[] = [];
    while (queue.length > 0 && batchIds.length < BATCH_SIZE && visited.size + batchIds.length < maxNodes) {
      const id = queue.shift()!;
      if (!visited.has(id)) {
        visited.add(id);
        batchIds.push(id);
      }
    }

    if (batchIds.length === 0) break;

    try {
      const mediaList = await fetchAniListMediaBatch(batchIds, false, signal, (sec) => {
        onProgress?.(
          visited.size,
          queue.length + visited.size,
          undefined,
          new Map(mediaMap),
          [...rawEdges],
          sec
        );
      });
      if (signal?.aborted) break;

      for (const media of mediaList) {
        mediaMap.set(media.id, media);

        if (media.relations?.edges) {
          for (const edge of media.relations.edges) {
            const relType = edge.relationType;
            const target = edge.node;

            if (!target || !target.id) continue;
            if (!ALLOWED_RELATIONS.includes(relType)) continue;
            if (target.format && DISALLOWED_FORMATS.includes(target.format)) continue;

            if (relType === 'SEQUEL') {
              addEdge(media.id, target.id, 'SEQUEL');
            } else if (relType === 'PREQUEL') {
              addEdge(target.id, media.id, 'SEQUEL');
            } else if (relType === 'PARENT') {
              addEdge(target.id, media.id, 'SIDE_STORY');
            } else if (relType === 'SIDE_STORY' || relType === 'SPIN_OFF') {
              addEdge(media.id, target.id, relType);
            } else if (relType === 'ALTERNATIVE') {
              if (media.seasonYear && target.seasonYear && target.seasonYear < media.seasonYear) {
                addEdge(target.id, media.id, 'ALTERNATIVE');
              } else {
                addEdge(media.id, target.id, 'ALTERNATIVE');
              }
            }

            if (!visited.has(target.id) && !queuedSet.has(target.id) && queuedSet.size < maxNodes) {
              queuedSet.add(target.id);
              queue.push(target.id);
            }
          }
        }
      }

      const latestMedia = mediaList[mediaList.length - 1];
      const title = latestMedia
        ? latestMedia.title.english || latestMedia.title.romaji || 'Unknown Anime'
        : 'Loading...';

      onProgress?.(
        visited.size,
        queue.length + visited.size,
        title,
        new Map(mediaMap),
        [...rawEdges],
        null
      );
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        break;
      }
      console.warn('Failed to fetch batch in crawler:', err);
      if (mediaMap.size === 0) {
        throw err;
      }
    }
  }

  if (mediaMap.size === 0 && !signal?.aborted) {
    throw new Error('Unable to load anime data. Please check your network or try again.');
  }

  return {
    mediaMap,
    rawEdges,
    rootId: rootMediaId,
  };
}
