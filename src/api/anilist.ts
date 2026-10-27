import type { AniListMedia, AniListUser, UserMediaListEntry } from '../types/anime';
import { idbGet, idbSet } from '../utils/db';
import { parseSearchInput } from '../utils/searchParser';

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const CACHE_PREFIX = 'paaru_cache_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const memoryCache = new Map<string, { timestamp: number; data: any }>();

async function getCached<T>(key: string): Promise<T | null> {
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.data as T;
  }

  try {
    const idbData = await idbGet<{ timestamp: number; data: T }>(CACHE_PREFIX + key);
    if (idbData && Date.now() - idbData.timestamp < CACHE_TTL_MS) {
      memoryCache.set(key, idbData);
      return idbData.data;
    }
  } catch {
  }

  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      memoryCache.set(key, parsed);
      return parsed.data as T;
    }
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  const payload = { timestamp: Date.now(), data };
  memoryCache.set(key, payload);
  idbSet(CACHE_PREFIX + key, payload).catch(() => {});
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
  }
}

async function queryAniList<T>(
  query: string,
  variables: Record<string, any>,
  signal?: AbortSignal,
  onRateLimit?: (secondsRemaining: number | null) => void
): Promise<T> {
  const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  if (response.status === 429) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const reset = response.headers.get('x-ratelimit-reset');
    const retryAfter = response.headers.get('Retry-After');
    let delaySeconds = 60;
    if (reset) {
      const resetNum = parseInt(reset, 10);
      if (resetNum > 1000000000) {
        delaySeconds = Math.max(1, resetNum - Math.floor(Date.now() / 1000));
      } else {
        delaySeconds = Math.max(1, resetNum);
      }
    } else if (retryAfter) {
      delaySeconds = Math.max(1, parseInt(retryAfter, 10));
    }

    console.warn(`[Paaru] AniList API rate limit hit (HTTP 429). Retrying after ${delaySeconds}s...`);

    for (let s = delaySeconds; s > 0; s--) {
      onRateLimit?.(s);
      await new Promise((r) => setTimeout(r, 1000));
      if (signal?.aborted) {
        onRateLimit?.(null);
        throw new DOMException('Aborted', 'AbortError');
      }
    }
    onRateLimit?.(null);

    return queryAniList<T>(query, variables, signal, onRateLimit);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || 'AniList API Error');
  }

  return json.data as T;
}

const MEDIA_CORE_FIELDS = `
    id
    idMal
    siteUrl
    title {
      romaji
      english
      native
      userPreferred
    }
    format
    episodes
    duration
    status
    seasonYear
    season
    averageScore
    meanScore
    popularity
    genres
    coverImage {
      medium
      large
      extraLarge
      color
    }
    bannerImage
    description(asHtml: false)
    trailer {
      id
      site
      thumbnail
    }
    studios(isMain: true) {
      edges {
        isMain
        node {
          id
          name
          siteUrl
        }
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          title {
            romaji
            english
          }
          format
          episodes
          status
          seasonYear
          coverImage {
            medium
            large
          }
        }
      }
    }
`;

const BATCH_MEDIA_QUERY = `
query GetBatchMedia($ids: [Int], $perPage: Int = 25) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
${MEDIA_CORE_FIELDS}
    }
  }
}
`;

const SEARCH_ANIME_QUERY = `
query SearchAnime(
  $search: String,
  $id: Int,
  $idMal: Int,
  $format_in: [MediaFormat],
  $seasonYear: Int,
  $page: Int = 1,
  $perPage: Int = 8
) {
  Page(page: $page, perPage: $perPage) {
    media(
      search: $search,
      id: $id,
      idMal: $idMal,
      format_in: $format_in,
      seasonYear: $seasonYear,
      type: ANIME,
      sort: [POPULARITY_DESC]
    ) {
      id
      title {
        romaji
        english
        native
      }
      format
      status
      episodes
      seasonYear
      coverImage {
        medium
        large
      }
      averageScore
    }
  }
}
`;

const USER_ANIME_LIST_QUERY = `
query GetUserAnimeList($userName: String) {
  User(name: $userName) {
    name
    avatar {
      medium
      large
    }
    siteUrl
  }
  MediaListCollection(userName: $userName, type: ANIME) {
    lists {
      name
      isCustomList
      status
      entries {
        mediaId
        status
        progress
        score(format: POINT_10_DECIMAL)
        updatedAt
      }
    }
  }
}
`;

export async function fetchAniListMediaBatch(
  ids: number[],
  forceRefresh = false,
  signal?: AbortSignal,
  onRateLimit?: (secondsRemaining: number | null) => void
): Promise<AniListMedia[]> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return [];

  const results: AniListMedia[] = [];
  const missingIds: number[] = [];

  for (const id of uniqueIds) {
    const cacheKey = `media_${id}`;
    if (!forceRefresh) {
      const cached = await getCached<AniListMedia>(cacheKey);
      if (cached) {
        results.push(cached);
        continue;
      }
    }
    missingIds.push(id);
  }

  if (missingIds.length === 0) {
    return results;
  }

  const data = await queryAniList<{ Page: { media: AniListMedia[] } }>(
    BATCH_MEDIA_QUERY,
    { ids: missingIds, perPage: missingIds.length },
    signal,
    onRateLimit
  );

  if (data?.Page?.media) {
    for (const media of data.Page.media) {
      setCached(`media_${media.id}`, media);
      results.push(media);
    }
  }

  return results;
}

export async function fetchAniListMedia(
  id: number,
  forceRefresh = false,
  signal?: AbortSignal
): Promise<AniListMedia> {
  const [media] = await fetchAniListMediaBatch([id], forceRefresh, signal);
  if (media) return media;
  throw new Error(`Anime with ID ${id} not found.`);
}

export async function searchAnime(query: string, signal?: AbortSignal): Promise<AniListMedia[]> {
  if (!query || query.trim().length === 0) return [];

  const parsed = parseSearchInput(query);
  const cacheKey = `search_${JSON.stringify(parsed)}`;
  const cached = await getCached<AniListMedia[]>(cacheKey);
  if (cached) return cached;

  const variables: Record<string, any> = {};

  if (parsed.type === 'anilist_url' || parsed.type === 'numeric_id') {
    variables.id = parsed.id;
  } else if (parsed.type === 'mal_url') {
    variables.idMal = parsed.idMal;
  } else {
    if (parsed.cleanText) variables.search = parsed.cleanText;
    if (parsed.format_in && parsed.format_in.length > 0) variables.format_in = parsed.format_in;
    if (parsed.seasonYear) variables.seasonYear = parsed.seasonYear;
  }

  if (!variables.id && !variables.idMal && !variables.search && !variables.seasonYear) {
    return [];
  }

  const data = await queryAniList<{ Page: { media: AniListMedia[] } }>(
    SEARCH_ANIME_QUERY,
    variables,
    signal
  );

  const results = data?.Page?.media || [];
  setCached(cacheKey, results);
  return results;
}

export async function fetchUserWatchList(
  userName: string,
  forceRefresh = false
): Promise<{ user: AniListUser; entries: Map<number, UserMediaListEntry> }> {
  const cleanUser = userName.trim();
  const cacheKey = `user_${cleanUser.toLowerCase()}`;

  if (!forceRefresh) {
    const cached = await getCached<{ user: AniListUser; entries: [number, UserMediaListEntry][] }>(cacheKey);
    if (cached) {
      return {
        user: cached.user,
        entries: new Map(cached.entries),
      };
    }
  }

  const data = await queryAniList<{
    User: AniListUser;
    MediaListCollection: {
      lists: Array<{
        name: string;
        status: string;
        entries: UserMediaListEntry[];
      }>;
    };
  }>(USER_ANIME_LIST_QUERY, { userName: cleanUser });

  const entryMap = new Map<number, UserMediaListEntry>();

  if (data?.MediaListCollection?.lists) {
    for (const list of data.MediaListCollection.lists) {
      for (const entry of list.entries) {
        if (!entryMap.has(entry.mediaId) || entry.status === 'COMPLETED') {
          entryMap.set(entry.mediaId, entry);
        }
      }
    }
  }

  const user = data.User || { name: cleanUser };

  setCached(cacheKey, {
    user,
    entries: Array.from(entryMap.entries()),
  });

  return { user, entries: entryMap };
}
