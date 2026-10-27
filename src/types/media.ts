export type SuiteMode = 'anime' | 'movies' | 'shows';

export interface UnifiedMediaItem {
  id: string;
  numericId: number;
  source: 'anilist' | 'tmdb_movie' | 'tmdb_tv';
  title: string;
  originalTitle?: string;
  releaseYear?: number | null;
  releaseDate?: string | null;
  format: 'TV' | 'MOVIE' | 'MINISERIES' | 'OVA' | 'ONA' | 'SPECIAL' | string;
  status?: string | null;
  episodes?: number | null;
  seasons?: number | null;
  runtimeMinutes?: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  ratingScore?: number | null;
  overview?: string | null;
  genres?: string[];
  studioOrNetwork?: string | null;
  trailerYoutubeId?: string | null;
  externalUrl?: string | null;
  externalMalUrl?: string | null;
}
