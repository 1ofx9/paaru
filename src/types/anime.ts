import type { SuiteMode } from './media';

export type RelationType = 
  | 'SEQUEL'
  | 'PREQUEL'
  | 'SIDE_STORY'
  | 'SPIN_OFF'
  | 'ALTERNATIVE'
  | 'PARENT'
  | 'SUMMARY'
  | 'CHARACTER'
  | 'OTHER';

export type WatchStatus = 
  | 'COMPLETED' 
  | 'CURRENT' 
  | 'PLANNING' 
  | 'DROPPED' 
  | 'PAUSED' 
  | 'UNWATCHED';

export interface AniListMediaTitle {
  romaji?: string;
  english?: string;
  native?: string;
  userPreferred?: string;
}

export interface AniListCoverImage {
  medium?: string;
  large?: string;
  extraLarge?: string;
  color?: string;
}

export interface AniListStudioEdge {
  isMain?: boolean;
  node?: {
    id: number;
    name: string;
    siteUrl?: string;
  };
}

export interface AniListTrailer {
  id?: string;
  site?: string;
  thumbnail?: string;
}

export interface AniListRelationNode {
  id: number;
  title: {
    romaji?: string;
    english?: string;
  };
  format?: string;
  episodes?: number;
  status?: string;
  seasonYear?: number;
  coverImage?: {
    medium?: string;
    large?: string;
  };
}

export interface AniListRelationEdge {
  relationType: RelationType;
  node: AniListRelationNode;
}

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  siteUrl?: string;
  title: AniListMediaTitle;
  format?: string;
  episodes?: number | null;
  duration?: number | null;
  status?: string;
  seasonYear?: number | null;
  season?: string | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  coverImage?: AniListCoverImage;
  bannerImage?: string | null;
  description?: string | null;
  genres?: string[];
  trailer?: AniListTrailer | null;
  studios?: {
    edges?: AniListStudioEdge[];
  };
  relations?: {
    edges: AniListRelationEdge[];
  };
}

export interface UserMediaListEntry {
  mediaId: number;
  status: 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';
  progress?: number;
  score?: number;
  updatedAt?: number;
}

export interface AniListUser {
  name: string;
  avatar?: {
    medium?: string;
    large?: string;
  };
  siteUrl?: string;
}

export type ViewMode = 'detailed' | 'compact';

export interface SearchHistoryItem {
  id: number;
  title: string;
  coverImage?: string;
  format?: string;
  seasonYear?: number | null;
  mode?: SuiteMode;
}

export interface TimelineStats {
  totalEntries: number;
  completedEntries: number;
  totalEpisodes: number;
  watchedEpisodes: number;
  remainingEpisodes: number;
  remainingHours: number;
  percentComplete: number;
}

export interface AnimeNodeData extends AniListMedia {
  [key: string]: unknown;
  suiteMode?: SuiteMode;
  watchStatus?: WatchStatus;
  userProgress?: number;
  userScore?: number;
  isNextUp?: boolean;
  isSearchedRoot?: boolean;
  viewMode?: ViewMode;
  isInPath?: boolean;
  isDirectHover?: boolean;
  isDimmed?: boolean;
}

export interface GraphFilterOptions {
  mainStoryOnly: boolean;
  hideSpinOffs: boolean;
  unwatchedOnly: boolean;
  orderMode: 'release' | 'chronological';
  hideSpecials?: boolean;
  releasedOnly?: boolean;
}
