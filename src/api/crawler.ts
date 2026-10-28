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

const DISALLOWED_FORMATS = ['MUSIC', 'MANGA', 'NOVEL', 'ONE_SHOT'];

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

  const universePhrases = new Set<string>();
  const universeTokens = new Set<string>();
  const STOPWORDS = new Set([
    'the', 'and', 'part', 'season', 'movie', 'special', 'ova', 'ona',
    'series', 'first', 'second', 'final', 'act', 'chapter', 'film', 'edition', 'stage'
  ]);

  function extractTokens(mediaTitle?: { english?: string; romaji?: string; native?: string }) {
    if (!mediaTitle) return;
    const titles = [mediaTitle.english, mediaTitle.romaji, mediaTitle.native].filter(Boolean) as string[];
    for (const title of titles) {
      const base = title.split(/[:\-~]|part|season/i)[0].trim().toLowerCase();
      if (base.length >= 3) {
        universePhrases.add(base);
      }
      const clean = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const parts = clean.split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
      parts.forEach((p) => universeTokens.add(p));
    }
  }

  function belongsToUniverse(t?: { english?: string; romaji?: string; native?: string }): boolean {
    if ((universePhrases.size === 0 && universeTokens.size === 0) || !t) return true;
    const combined = `${t.english || ''} ${t.romaji || ''} ${t.native || ''}`.toLowerCase();
    for (const phrase of universePhrases) {
      if (combined.includes(phrase)) return true;
    }
    for (const token of universeTokens) {
      if (combined.includes(token)) return true;
    }
    return false;
  }

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

        if (media.id === rootMediaId) {
          extractTokens(media.title);
        }

        const isMediaCrossover =
          media.id !== rootMediaId &&
          (/\b(vs\.?|x)\b/i.test(media.title?.english || '') ||
            /\b(vs\.?|x)\b/i.test(media.title?.romaji || ''));

        if (media.relations?.edges) {
          for (const edge of media.relations.edges) {
            const relType = edge.relationType;
            const target = edge.node;

            if (!target || !target.id) continue;
            if (!ALLOWED_RELATIONS.includes(relType)) continue;
            if (target.format && DISALLOWED_FORMATS.includes(target.format)) continue;

            // Block crossover universe leaks: do not follow PARENT on non-root, and do not crawl out of crossover nodes
            if (relType === 'PARENT' && media.id !== rootMediaId) continue;
            if (isMediaCrossover) continue;

            // Block unrelated anime from entering the universe graph
            if (!belongsToUniverse(target.title)) {
              continue;
            }

            if (relType === 'SEQUEL') {
              const isMediaMovie = media.format === 'MOVIE';
              const isTargetMovie = target.format === 'MOVIE';
              if (isMediaMovie && isTargetMovie) {
                // Standalone theatrical movies are side stories, not strict narrative sequential dependencies
                addEdge(media.id, target.id, 'SIDE_STORY');
              } else {
                addEdge(media.id, target.id, 'SEQUEL');
              }
            } else if (relType === 'PREQUEL') {
              const isMediaMovie = media.format === 'MOVIE';
              const isTargetMovie = target.format === 'MOVIE';
              if (isMediaMovie && isTargetMovie) {
                addEdge(target.id, media.id, 'SIDE_STORY');
              } else {
                const mYear = media.seasonYear || (media as any).startDate?.year;
                const tYear = target.seasonYear || (target as any).startDate?.year;
                if (mYear && tYear && tYear > mYear + 1) {
                  addEdge(media.id, target.id, 'SIDE_STORY');
                } else {
                  addEdge(target.id, media.id, 'SEQUEL');
                }
              }
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
