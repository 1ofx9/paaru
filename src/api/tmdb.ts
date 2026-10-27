import { idbGet, idbSet } from '../utils/db';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function getTMDBKey(): string {
  const customKey = localStorage.getItem('paaru_tmdb_key');
  if (customKey && customKey.trim()) return customKey.trim();
  return import.meta.env.VITE_TMDB_API_KEY || '';
}

export function hasTMDBKey(): boolean {
  return Boolean(getTMDBKey());
}

export function hasCustomTMDBKey(): boolean {
  const customKey = localStorage.getItem('paaru_tmdb_key');
  return Boolean(customKey && customKey.trim());
}

export function setTMDBKey(key: string): void {
  const sanitized = key.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitized) {
    localStorage.setItem('paaru_tmdb_key', sanitized);
  } else {
    localStorage.removeItem('paaru_tmdb_key');
  }
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  runtime?: number | null;
  status?: string;
  genres?: { id: number; name: string }[];
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
  } | null;
  videos?: {
    results: {
      key: string;
      site: string;
      type: string;
    }[];
  };
  recommendations?: {
    results: {
      id: number;
      name: string;
      overview?: string;
      first_air_date?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      vote_average?: number;
    }[];
  };
}

export interface TMDBCollectionPart {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
}

export interface TMDBCollection {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts: TMDBCollectionPart[];
}

export interface TMDBTVSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date?: string | null;
  poster_path?: string | null;
  overview?: string;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  last_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  genres?: { id: number; name: string }[];
  networks?: { id: number; name: string }[];
  seasons?: TMDBTVSeason[];
  videos?: {
    results: {
      key: string;
      site: string;
      type: string;
    }[];
  };
  recommendations?: {
    results: {
      id: number;
      name: string;
      overview?: string;
      first_air_date?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      vote_average?: number;
    }[];
  };
}

export function getTMDBImageUrl(path: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  const key = getTMDBKey();
  if (!key) {
    throw new Error('MISSING_TMDB_KEY');
  }

  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.set('api_key', key);
  for (const [k, val] of Object.entries(params)) {
    url.searchParams.set(k, String(val));
  }

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new Error(errorJson?.status_message || `TMDB API Error: ${res.status}`);
  }
  return res.json();
}

export async function searchTMDBMovies(query: string, year?: number, signal?: AbortSignal): Promise<TMDBMovie[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = `tmdb_search_movie_${trimmed.toLowerCase()}_${year || 'all'}`;
  const cached = await idbGet<TMDBMovie[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string | number> = { query: trimmed };
  if (year && year > 1800) {
    params.primary_release_year = year;
  }

  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/search/movie', params, signal);
  const results = data.results || [];
  await idbSet(cacheKey, results);
  return results;
}

export async function searchTMDBShows(query: string, year?: number, signal?: AbortSignal): Promise<TMDBTVShow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = `tmdb_search_tv_${trimmed.toLowerCase()}_${year || 'all'}`;
  const cached = await idbGet<TMDBTVShow[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string | number> = { query: trimmed };
  if (year && year > 1800) {
    params.first_air_date_year = year;
  }

  const data = await tmdbFetch<{ results: TMDBTVShow[] }>('/search/tv', params, signal);
  const results = data.results || [];
  await idbSet(cacheKey, results);
  return results;
}

export async function fetchTMDBMovieDetails(id: number, signal?: AbortSignal): Promise<TMDBMovie> {
  const cacheKey = `tmdb_movie_${id}`;
  const cached = await idbGet<TMDBMovie>(cacheKey);
  if (cached) return cached;

  const data = await tmdbFetch<TMDBMovie>(`/movie/${id}`, { append_to_response: 'videos,credits' }, signal);
  await idbSet(cacheKey, data);
  return data;
}

export async function fetchTMDBCollection(collectionId: number, signal?: AbortSignal): Promise<TMDBCollection> {
  const cacheKey = `tmdb_collection_${collectionId}`;
  const cached = await idbGet<TMDBCollection>(cacheKey);
  if (cached) return cached;

  const data = await tmdbFetch<TMDBCollection>(`/collection/${collectionId}`, {}, signal);
  await idbSet(cacheKey, data);
  return data;
}

export async function fetchTMDBTVDetails(id: number, signal?: AbortSignal): Promise<TMDBTVShow> {
  const cacheKey = `tmdb_tv_${id}`;
  const cached = await idbGet<TMDBTVShow>(cacheKey);
  if (cached) return cached;

  const data = await tmdbFetch<TMDBTVShow>(`/tv/${id}`, { append_to_response: 'videos,credits,recommendations' }, signal);
  await idbSet(cacheKey, data);
  return data;
}
