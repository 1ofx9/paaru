import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  User,
  Filter,
  HelpCircle,
  X,
  Sun,
  Moon,
  Loader2,
  Star,
  Heart,
  CornerDownLeft,
  ArrowUpDown,
  AlertCircle,
  Home,
  History,
  Trash2,
  Crosshair,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Node as FlowNode } from '@xyflow/react';
import { searchAnime } from '../api/anilist';
import { searchTMDBMovies, searchTMDBShows, getTMDBImageUrl, getTMDBKey, setTMDBKey, hasTMDBKey } from '../api/tmdb';
import type { AnimeNodeData, AniListUser, AniListMedia, GraphFilterOptions, SearchHistoryItem, UserMediaListEntry, TimelineStats } from '../types/anime';
import type { SuiteMode } from '../types/media';
import { formatMediaType, formatEpisodeCount } from '../utils/formatters';
import { parseSearchInput } from '../utils/searchParser';
import { Tooltip } from './Tooltip';

interface FloatingNavProps {
  user: AniListUser | null;
  userName: string;
  isLoadingUser: boolean;
  userError?: string | null;
  onClearUserError?: () => void;
  onSyncUser: (name: string) => Promise<boolean> | void;
  onRefreshUser: () => void;
  onLogoutUser: () => void;
  filters: GraphFilterOptions;
  onUpdateFilters: (filters: Partial<GraphFilterOptions>) => void;
  onOpenLegend: () => void;
  hasActiveAnime: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSelectTimeline: (id: number, mode?: SuiteMode) => void;
  onClearTimeline?: () => void;
  nodes?: FlowNode<AnimeNodeData>[];
  userEntries?: Map<number, UserMediaListEntry> | null;
  onFocusNode?: (id: number) => void;
  suiteMode: SuiteMode;
  onSelectSuiteMode: (mode: SuiteMode) => void;
  timelineStats?: TimelineStats | null;
  isLoading?: boolean;
  progress?: {
    loaded: number;
    total: number;
    currentTitle: string;
    rateLimitSeconds?: number | null;
  } | null;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  user,
  userName,
  isLoadingUser,
  userError,
  onClearUserError,
  onSyncUser,
  onRefreshUser,
  onLogoutUser,
  filters,
  onUpdateFilters,
  onOpenLegend,
  hasActiveAnime,
  theme,
  onToggleTheme,
  onSelectTimeline,
  onClearTimeline,
  nodes,
  userEntries,
  onFocusNode,
  suiteMode,
  onSelectSuiteMode,
  timelineStats,
  isLoading,
  progress,
}) => {
  const stats = timelineStats;
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [inputUsername, setInputUsername] = useState(userName);
  const [isTMDBKeyModalOpen, setIsTMDBKeyModalOpen] = useState(false);
  const [inputTMDBKey, setInputTMDBKey] = useState(getTMDBKey);
  const [showTMDBKey, setShowTMDBKey] = useState(false);
  const [tmdbKeySaved, setTmdbKeySaved] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const getRecentsKey = (mode: SuiteMode) => `paaru_recents_${mode}`;
  const getFavoritesKey = (mode: SuiteMode) => `paaru_favorites_${mode}`;

  const [recents, setRecents] = useState<SearchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(getRecentsKey(suiteMode));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favorites, setFavorites] = useState<SearchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(getFavoritesKey(suiteMode));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const savedR = localStorage.getItem(getRecentsKey(suiteMode));
      const savedF = localStorage.getItem(getFavoritesKey(suiteMode));
      setRecents(savedR ? JSON.parse(savedR) : []);
      setFavorites(savedF ? JSON.parse(savedF) : []);
    } catch {
      setRecents([]);
      setFavorites([]);
    }
    setSearchResults([]);
    setSearchQuery('');
  }, [suiteMode]);

  const saveRecents = (list: SearchHistoryItem[]) => {
    setRecents(list);
    try {
      localStorage.setItem(getRecentsKey(suiteMode), JSON.stringify(list));
    } catch {}
  };

  const saveFavorites = (list: SearchHistoryItem[]) => {
    setFavorites(list);
    try {
      localStorage.setItem(getFavoritesKey(suiteMode), JSON.stringify(list));
    } catch {}
  };

  const addToRecents = (item: SearchHistoryItem) => {
    const filtered = recents.filter((r) => r.id !== item.id);
    const updated = [item, ...filtered].slice(0, 6);
    saveRecents(updated);
  };

  const removeRecent = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    saveRecents(recents.filter((r) => r.id !== id));
  };

  const clearAllRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveRecents([]);
  };

  const toggleFavorite = (item: SearchHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const exists = favorites.some((f) => f.id === item.id);
    if (exists) {
      saveFavorites(favorites.filter((f) => f.id !== item.id));
    } else {
      saveFavorites([item, ...favorites].slice(0, 12));
    }
  };

  const handleSelectMediaItem = (item: SearchHistoryItem) => {
    const itemMode = item.mode || suiteMode;
    addToRecents({ ...item, mode: itemMode });
    if (itemMode !== suiteMode) {
      onSelectSuiteMode(itemMode);
    }
    onSelectTimeline(item.id, itemMode);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  };

  const filterRef = useRef<HTMLDivElement>(null);
  const userModalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const isPastedRef = useRef(false);
  const searchCacheRef = useRef<Map<string, AniListMedia[]>>(new Map());

  const parsedQuery = useMemo(() => {
    return parseSearchInput(searchQuery);
  }, [searchQuery]);

  const inGraphMatches = useMemo(() => {
    if (!nodes || nodes.length === 0 || !searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q.startsWith('http') || q.includes('.co') || q.includes('.net')) return [];

    return nodes
      .filter((node) => {
        const eng = (node.data.title.english || '').toLowerCase();
        const rom = (node.data.title.romaji || '').toLowerCase();
        const nat = (node.data.title.native || '').toLowerCase();
        return eng.includes(q) || rom.includes(q) || nat.includes(q);
      })
      .slice(0, 4);
  }, [nodes, searchQuery]);

  const selectableItems = useMemo(() => {
    const items: Array<
      | { type: 'graph'; id: number; node: FlowNode<AnimeNodeData> }
      | { type: 'media'; id: number; media: AniListMedia }
    > = [];

    for (const node of inGraphMatches) {
      items.push({ type: 'graph', id: node.data.id, node });
    }

    for (const media of searchResults) {
      if (!inGraphMatches.some((n) => n.data.id === media.id)) {
        items.push({ type: 'media', id: media.id, media });
      }
    }

    return items;
  }, [inGraphMatches, searchResults]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      setSelectedIndex(0);
      return;
    }

    const parsed = parseSearchInput(trimmed);
    const isDirect = parsed.type === 'anilist_url' || parsed.type === 'numeric_id' || parsed.type === 'mal_url';

    const cacheKey = `${suiteMode}_${JSON.stringify(parsed)}`;
    if (searchCacheRef.current.has(cacheKey)) {
      setSearchResults(searchCacheRef.current.get(cacheKey)!);
      setIsSearching(false);
      return;
    }

    if (!isDirect && parsed.cleanText.length < 2 && !parsed.format_in && !parsed.seasonYear) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const delay = isPastedRef.current || isDirect ? 0 : 220;
    isPastedRef.current = false;

    const timeout = setTimeout(async () => {
      try {
        if (parsed.type === 'anilist_url' && parsed.id) {
          if (suiteMode !== 'anime') onSelectSuiteMode('anime');
          onSelectTimeline(parsed.id, 'anime');
          setSearchQuery('');
          setIsSearching(false);
          return;
        }
        if (parsed.type === 'tmdb_movie_url' && parsed.id) {
          if (suiteMode !== 'movies') onSelectSuiteMode('movies');
          onSelectTimeline(parsed.id, 'movies');
          setSearchQuery('');
          setIsSearching(false);
          return;
        }
        if (parsed.type === 'tmdb_tv_url' && parsed.id) {
          if (suiteMode !== 'shows') onSelectSuiteMode('shows');
          onSelectTimeline(parsed.id, 'shows');
          setSearchQuery('');
          setIsSearching(false);
          return;
        }

        const queryText = parsed.cleanText || trimmed;
        const searchYear = parsed.seasonYear;

        if (suiteMode === 'movies') {
          if (!hasTMDBKey()) {
            setIsSearching(false);
            setSearchResults([]);
            return;
          }
          const tmdbMovies = await searchTMDBMovies(queryText, searchYear, controller.signal);
          const mapped: AniListMedia[] = tmdbMovies.map((m) => {
            const releaseYear = m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : undefined;
            return {
              id: m.id,
              title: { english: m.title, romaji: m.title },
              format: 'MOVIE',
              seasonYear: releaseYear,
              startDate: m.release_date ? { year: releaseYear } : undefined,
              averageScore: m.vote_average ? Math.round(m.vote_average * 10) : undefined,
              description: m.overview,
              coverImage: {
                large: getTMDBImageUrl(m.poster_path, 'w500') || undefined,
                medium: getTMDBImageUrl(m.poster_path, 'w185') || undefined,
              },
              bannerImage: getTMDBImageUrl(m.backdrop_path, 'w780') || undefined,
              siteUrl: `https://www.themoviedb.org/movie/${m.id}`,
            };
          });
          searchCacheRef.current.set(cacheKey, mapped);
          setSearchResults(mapped);
          setSelectedIndex(0);
        } else if (suiteMode === 'shows') {
          if (!hasTMDBKey()) {
            setIsSearching(false);
            setSearchResults([]);
            return;
          }
          const tmdbShows = await searchTMDBShows(queryText, searchYear, controller.signal);
          const mapped: AniListMedia[] = tmdbShows.map((s) => {
            const releaseYear = s.first_air_date ? parseInt(s.first_air_date.substring(0, 4), 10) : undefined;
            return {
              id: s.id,
              title: { english: s.name, romaji: s.name },
              format: 'TV',
              seasonYear: releaseYear,
              startDate: s.first_air_date ? { year: releaseYear } : undefined,
              averageScore: s.vote_average ? Math.round(s.vote_average * 10) : undefined,
              description: s.overview,
              coverImage: {
                large: getTMDBImageUrl(s.poster_path, 'w500') || undefined,
                medium: getTMDBImageUrl(s.poster_path, 'w185') || undefined,
              },
              bannerImage: getTMDBImageUrl(s.backdrop_path, 'w780') || undefined,
              siteUrl: `https://www.themoviedb.org/tv/${s.id}`,
            };
          });
          searchCacheRef.current.set(cacheKey, mapped);
          setSearchResults(mapped);
          setSelectedIndex(0);
        } else {
          const res = await searchAnime(trimmed, controller.signal);
          searchCacheRef.current.set(cacheKey, res);
          setSearchResults(res);
          setSelectedIndex(0);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Search error:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, delay);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, suiteMode, onSelectTimeline, onSelectSuiteMode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | PointerEvent) {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (userModalRef.current && !userModalRef.current.contains(target)) {
        setIsUserModalOpen(false);
        setIsTMDBKeyModalOpen(false);
      }
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(target) &&
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(target)
      ) {
        setSearchResults([]);
        setIsSearchFocused(false);
      }
    }

    document.addEventListener('pointerdown', handleClickOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
    };
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
      return;
    }

    if (selectableItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % selectableItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectableItems[selectedIndex];
      if (target) {
        if (target.type === 'graph') {
          onFocusNode?.(target.id);
          setIsSearchFocused(false);
          setSearchQuery('');
          setSearchResults([]);
          searchInputRef.current?.blur();
        } else {
          handleSelectMediaItem({
            id: target.media.id,
            title: target.media.title.english || target.media.title.romaji || 'Unknown Title',
            coverImage: target.media.coverImage?.medium || target.media.coverImage?.large,
            format: target.media.format,
            seasonYear: target.media.seasonYear,
            mode: suiteMode,
          });
        }
      }
    }
  };

  const renderWatchlistBadge = (mediaId: number) => {
    if (suiteMode !== 'anime' || !userEntries) return null;
    const entry = userEntries.get(mediaId);
    if (!entry) return null;

    let label = '';
    let colorClasses = '';

    switch (entry.status) {
      case 'COMPLETED':
        label = 'Completed';
        colorClasses = 'bg-zinc-900/10 text-zinc-950 dark:bg-white/10 dark:text-zinc-100 border-zinc-900/20 dark:border-white/20';
        break;
      case 'CURRENT':
        label = entry.progress ? `Watching (${entry.progress} ep)` : 'Watching';
        colorClasses = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
        break;
      case 'PLANNING':
        label = 'Plan to Watch';
        colorClasses = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20';
        break;
      case 'PAUSED':
        label = 'Paused';
        colorClasses = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20';
        break;
      case 'DROPPED':
        label = 'Dropped';
        colorClasses = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20';
        break;
      default:
        label = entry.status;
        colorClasses = 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/20';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono border font-medium ${colorClasses}`}>
        <span>{label}</span>
        {entry.score && entry.score > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <span>•</span>
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
            <span>{entry.score}</span>
          </span>
        ) : null}
      </span>
    );
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUsername.trim()) {
      onClearUserError?.();
      const success = await onSyncUser(inputUsername.trim());
      if (success) {
        setIsUserModalOpen(false);
      }
    }
  };

  const hasActiveFilters =
    filters.mainStoryOnly ||
    filters.hideSpinOffs ||
    Boolean(filters.hideSpecials) ||
    Boolean(filters.releasedOnly) ||
    filters.unwatchedOnly ||
    filters.orderMode === 'chronological';
  const hasSearchResults = searchQuery.trim().length > 0;

  return (
    <>
      <header
        className={`fixed z-40 pointer-events-none left-1/2 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-full px-3 sm:px-0 sm:w-fit ${
          hasActiveAnime
            ? 'top-4 sm:top-5 translate-y-0'
            : !hasActiveAnime && isSearchFocused
            ? 'top-8 sm:top-[calc(50%+8px)] sm:-translate-y-1/2'
            : 'top-[calc(50%+8px)] -translate-y-1/2 flex flex-col items-center justify-center'
        }`}
      >
        <div
          ref={searchWrapperRef}
          className="relative pointer-events-auto flex flex-col items-center w-full sm:w-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        >
          <div
            className={`flex flex-col items-center text-center select-none pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              hasActiveAnime
                ? 'opacity-0 -translate-y-6 max-h-0 mb-0 overflow-hidden scale-95 pointer-events-none'
                : isSearchFocused
                ? 'opacity-0 -translate-y-2 max-h-0 mb-0 overflow-hidden sm:opacity-100 sm:translate-y-0 sm:max-h-40 sm:mb-5 sm:mb-6 sm:scale-100'
                : 'opacity-100 translate-y-0 max-h-40 mb-5 sm:mb-6 scale-100'
            }`}
          >
            <h1 className="flex items-baseline justify-center gap-2 sm:gap-2.5 text-5xl sm:text-6xl md:text-[64px] select-none leading-none">
              <span className="relative inline-flex items-baseline overflow-hidden py-1">
                <span
                  key={suiteMode}
                  className="font-editorial italic font-normal tracking-tight text-[1.14em] sm:text-[1.18em] text-zinc-400 dark:text-zinc-400 lowercase pr-0.5 inline-block animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out"
                >
                  {suiteMode === 'movies' ? 'movies' : suiteMode === 'shows' ? 'shows' : 'anime'}
                </span>
              </span>
              <span className="font-tech font-bold tracking-tight text-zinc-950 dark:text-white uppercase">
                PAARU
              </span>
            </h1>
            <div className="relative overflow-hidden py-0.5">
              <p
                key={suiteMode}
                className="mt-2 text-xs sm:text-[13.5px] text-zinc-500 dark:text-zinc-400 font-sans tracking-normal max-w-xs sm:max-w-sm mx-auto leading-normal animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out"
              >
                {suiteMode === 'movies'
                  ? 'Film sagas and chronological release timelines'
                  : suiteMode === 'shows'
                  ? 'Television universes and connected series timelines'
                  : 'Chronological watch orders and interactive timeline graphs'}
              </p>
            </div>
          </div>

          <div className={`relative ${hasActiveAnime ? 'mb-2.5 sm:mb-3' : 'mb-4 sm:mb-5'} p-1 text-xs sm:text-sm w-68 sm:w-76 pointer-events-auto flex items-center rounded-full bg-zinc-200/50 dark:bg-white/5 border border-zinc-300/40 dark:border-white/10 font-sans font-medium text-zinc-600 dark:text-zinc-400 backdrop-blur-md shadow-xs select-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]`}>
            <div
              className="absolute top-1 bottom-1 rounded-full bg-white dark:bg-zinc-800 shadow-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
              style={{
                width: 'calc((100% - 8px) / 3)',
                left: suiteMode === 'anime'
                  ? '4px'
                  : suiteMode === 'movies'
                  ? 'calc(4px + (100% - 8px) / 3)'
                  : 'calc(4px + 2 * (100% - 8px) / 3)',
              }}
            />
            <button
              type="button"
              onClick={() => onSelectSuiteMode('anime')}
              className={`relative z-10 flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-center rounded-full transition-colors duration-200 cursor-pointer ${
                suiteMode === 'anime'
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Anime
            </button>
            <button
              type="button"
              onClick={() => onSelectSuiteMode('movies')}
              className={`relative z-10 flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-center rounded-full transition-colors duration-200 cursor-pointer ${
                suiteMode === 'movies'
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Movies
            </button>
            <button
              type="button"
              onClick={() => onSelectSuiteMode('shows')}
              className={`relative z-10 flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-center rounded-full transition-colors duration-200 cursor-pointer ${
                suiteMode === 'shows'
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Shows
            </button>
          </div>

          <div
            className={`relative bg-white/95 dark:bg-zinc-950/40 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 rounded-full flex items-center justify-between transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-full sm:w-auto ${
              hasActiveAnime
                ? 'px-3 sm:px-3.5 py-1.5 sm:py-2 min-h-10 sm:min-h-11.5 gap-1.5 sm:gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-2xl'
                : 'px-3.5 sm:px-4.5 py-2 sm:py-2.5 min-h-11 sm:min-h-13 gap-2 sm:gap-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2.5 pl-0.5 sm:pl-1 pr-1 flex-1 min-w-0">
              {hasActiveAnime && onClearTimeline && (
                <Tooltip content="Back to search" kbd="Esc" side="bottom">
                  <button
                    type="button"
                    onClick={onClearTimeline}
                    className="w-6.5 h-6.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer mr-0.5 shrink-0"
                  >
                    <Home className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              <Search
                className={`text-zinc-400 dark:text-zinc-500 shrink-0 ${
                  hasActiveAnime ? 'w-4 h-4 sm:w-4.5 sm:h-4.5' : 'w-4.5 h-4.5 sm:w-5 sm:h-5'
                }`}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  hasActiveAnime
                    ? "Search, jump, or paste..."
                    : suiteMode === 'movies'
                    ? "Search movies, sagas, collections..."
                    : suiteMode === 'shows'
                    ? "Search TV shows, series, universes..."
                    : "Search anime, paste link or ID..."
                }
                value={searchQuery}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setIsFilterOpen(false);
                  setIsUserModalOpen(false);
                }}
                onPaste={() => {
                  isPastedRef.current = true;
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className={`bg-transparent text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex-1 min-w-0 ${
                  hasActiveAnime
                    ? 'sm:w-48 sm:focus:w-68'
                    : 'sm:w-64 sm:focus:w-84'
                }`}
              />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500 animate-spin shrink-0" />
              ) : searchQuery ? (
                <Tooltip content="Clear search" side="bottom">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setIsSearchFocused(true);
                      searchInputRef.current?.focus();
                    }}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tooltip>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/4 border border-zinc-200 dark:border-white/10 text-[11px] font-mono text-zinc-400 select-none">
                  ⌘K
                </kbd>
              )}
            </div>

            <div className={`w-px bg-zinc-200 dark:bg-white/10 mx-0.5 ${hasActiveAnime ? 'h-5' : 'h-6'}`} />

            <div ref={filterRef}>
              <Tooltip content="Timeline Filters" side="bottom">
                <button
                  onClick={() => {
                    setIsFilterOpen(!isFilterOpen);
                    if (!isFilterOpen) {
                      setIsUserModalOpen(false);
                      setSearchResults([]);
                      setIsSearchFocused(false);
                    }
                  }}
                  className={`relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border text-xs font-medium flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    hasActiveFilters
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                      : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/6'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {hasActiveFilters && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950" />
                  )}
                </button>
              </Tooltip>

              {isFilterOpen && (
                <div className="absolute right-0 sm:right-3 top-full mt-3 w-58 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-3 pt-2 pb-1 font-semibold block font-sans">
                    {suiteMode === 'movies' ? 'Movie Filters' : suiteMode === 'shows' ? 'TV Show Filters' : 'Anime Filters'}
                  </span>

                  {suiteMode === 'movies' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ releasedOnly: !filters.releasedOnly })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.releasedOnly
                            ? 'bg-zinc-900/10 text-zinc-950 border border-zinc-900/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Released Only</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.releasedOnly
                              ? 'bg-zinc-900 dark:bg-white'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ mainStoryOnly: !filters.mainStoryOnly })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.mainStoryOnly
                            ? 'bg-zinc-900/10 text-zinc-950 border border-zinc-900/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Main Saga Only</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.mainStoryOnly
                              ? 'bg-zinc-900 dark:bg-white'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ hideSpinOffs: !filters.hideSpinOffs })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.hideSpinOffs
                            ? 'bg-[#059669]/10 text-[#047857] border border-[#059669]/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Hide Spin-offs</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.hideSpinOffs
                              ? 'bg-[#059669] dark:bg-[#a7f3d0]'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>
                    </>
                  ) : suiteMode === 'shows' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ mainStoryOnly: !filters.mainStoryOnly })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.mainStoryOnly
                            ? 'bg-zinc-900/10 text-zinc-950 border border-zinc-900/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Regular Seasons</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.mainStoryOnly
                              ? 'bg-zinc-900 dark:bg-white'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ releasedOnly: !filters.releasedOnly })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.releasedOnly
                            ? 'bg-zinc-900/10 text-zinc-950 border border-zinc-900/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Aired Only</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.releasedOnly
                              ? 'bg-zinc-900 dark:bg-white'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ hideSpinOffs: !filters.hideSpinOffs })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.hideSpinOffs
                            ? 'bg-[#059669]/10 text-[#047857] border border-[#059669]/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Hide Specials & Extras</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.hideSpinOffs
                              ? 'bg-[#059669] dark:bg-[#a7f3d0]'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ mainStoryOnly: !filters.mainStoryOnly })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.mainStoryOnly
                            ? 'bg-zinc-900/10 text-zinc-950 border border-zinc-900/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Main Story Only</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.mainStoryOnly
                              ? 'bg-zinc-900 dark:bg-white'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ hideSpinOffs: !filters.hideSpinOffs })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.hideSpinOffs
                            ? 'bg-[#059669]/10 text-[#047857] border border-[#059669]/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Hide Spin-offs</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.hideSpinOffs
                              ? 'bg-[#059669] dark:bg-[#a7f3d0]'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ hideSpecials: !filters.hideSpecials })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.hideSpecials
                            ? 'bg-[#0284c7]/10 text-[#0369a1] border border-[#0284c7]/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Hide OVAs & Specials</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.hideSpecials
                              ? 'bg-[#0284c7] dark:bg-[#bae6fd]'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ unwatchedOnly: !filters.unwatchedOnly })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-colors cursor-pointer ${
                          filters.unwatchedOnly
                            ? 'bg-[#f59e0b]/10 text-[#b45309] border border-[#f59e0b]/20 dark:bg-white/15 dark:text-white dark:border-transparent font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <span>Unwatched Only</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            filters.unwatchedOnly
                              ? 'bg-[#f59e0b] dark:bg-[#fde68a]'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        />
                      </button>
                    </>
                  )}

                  <div className="mt-1 pt-1.5 border-t border-zinc-200 dark:border-white/10">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-3 py-1 font-semibold block font-sans">
                      {suiteMode === 'movies' ? 'Movie Order' : suiteMode === 'shows' ? 'Broadcast Order' : 'Graph Order'}
                    </span>
                    <div className="grid grid-cols-2 gap-1 px-1 py-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ orderMode: 'release' })}
                        className={`py-1.5 text-[11px] font-sans font-medium rounded-lg transition-colors cursor-pointer ${
                          filters.orderMode === 'release'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        {suiteMode === 'movies' ? 'Release Date' : suiteMode === 'shows' ? 'Broadcast' : 'Release'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateFilters({ orderMode: 'chronological' })}
                        className={`py-1.5 text-[11px] font-sans font-medium rounded-lg transition-colors cursor-pointer ${
                          filters.orderMode === 'chronological'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        {suiteMode === 'movies' ? 'Story Order' : suiteMode === 'shows' ? 'Timeline' : 'Chronological'}
                      </button>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateFilters({
                          mainStoryOnly: false,
                          hideSpinOffs: false,
                          hideSpecials: false,
                          releasedOnly: false,
                          unwatchedOnly: false,
                          orderMode: 'release',
                        })
                      }
                      className="mt-1 pt-2 border-t border-zinc-200 dark:border-white/10 text-[11px] font-sans text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white py-1 text-center w-full cursor-pointer transition-colors"
                    >
                      Reset all filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {suiteMode === 'anime' ? (
              <div ref={userModalRef}>
                {user ? (
                  <Tooltip content={`AniList: ${user.name}`} side="bottom">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserModalOpen(!isUserModalOpen);
                        if (!isUserModalOpen) {
                          setIsFilterOpen(false);
                          setSearchResults([]);
                          onClearUserError?.();
                        }
                      }}
                      className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border overflow-hidden flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        isUserModalOpen
                          ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900/15 dark:ring-white/20 shadow-xs'
                          : 'border-zinc-200/90 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/30'
                      }`}
                    >
                      {user.avatar?.medium ? (
                        <img
                          src={user.avatar.medium}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center text-xs font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Connect AniList" side="bottom">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserModalOpen(!isUserModalOpen);
                        if (!isUserModalOpen) {
                          setIsFilterOpen(false);
                          setSearchResults([]);
                          onClearUserError?.();
                        }
                      }}
                      className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border text-xs font-medium flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        isUserModalOpen
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                          : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/6'
                      }`}
                    >
                      <User className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}

                {isUserModalOpen && (
                  <div className="absolute right-0 sm:right-3 top-full mt-3 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                    {user ? (
                      <>
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-semibold font-sans">
                            AniList Account
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsUserModalOpen(false)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-50 dark:bg-white/4 border border-zinc-200/60 dark:border-white/5">
                          {user.avatar?.medium ? (
                            <img
                              src={user.avatar.medium}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover border border-zinc-200/80 dark:border-white/10"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center text-sm font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {user.name}
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Connected
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={onRefreshUser}
                            disabled={isLoadingUser}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/8 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingUser ? 'animate-spin' : ''}`} />
                            <span>Sync List</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onLogoutUser();
                              setIsUserModalOpen(false);
                            }}
                            className="py-1.5 px-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-semibold font-sans">
                            Connect AniList
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserModalOpen(false);
                              onClearUserError?.();
                            }}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <form onSubmit={handleUserSubmit} className="space-y-2">
                          <input
                            type="text"
                            placeholder="AniList username..."
                            value={inputUsername}
                            onChange={(e) => {
                              setInputUsername(e.target.value);
                              if (userError) onClearUserError?.();
                            }}
                            autoFocus
                            className="w-full px-3 py-2 text-xs bg-zinc-100 dark:bg-white/4 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-xl border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                          />

                          {userError && (
                            <div className="p-2 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/25 text-red-600 dark:text-red-400 text-[11px] leading-tight flex items-start gap-1.5 font-sans">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{userError}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsUserModalOpen(false);
                                onClearUserError?.();
                              }}
                              className="flex-1 py-1.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={!inputUsername.trim() || isLoadingUser}
                              className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {isLoadingUser ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Syncing...
                                </>
                              ) : (
                                'Connect'
                              )}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div ref={userModalRef}>
                <Tooltip content="TMDB API Settings" side="bottom">
                  <button
                    onClick={() => {
                      const next = !isTMDBKeyModalOpen;
                      setIsTMDBKeyModalOpen(next);
                      if (next) {
                        setIsFilterOpen(false);
                        setIsUserModalOpen(false);
                        setIsSearchFocused(false);
                        setSearchResults([]);
                        searchInputRef.current?.blur();
                        setInputTMDBKey(getTMDBKey());
                        setTmdbKeySaved(false);
                      }
                    }}
                    className={`relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border text-xs font-medium flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      isTMDBKeyModalOpen
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                        : !hasTMDBKey()
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                        : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/6'
                    }`}
                  >
                    <Key className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    {!hasTMDBKey() && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </button>
                </Tooltip>

                {isTMDBKeyModalOpen && (
                  <div className="absolute right-0 sm:right-3 top-full mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-3.5 z-50 flex flex-col gap-2.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-semibold font-sans">
                        TMDB API Settings
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsTMDBKeyModalOpen(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                      Paaru Movies and Shows query The Movie Database directly. Enter your free TMDB v3 API key below to unlock search and timelines.
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setTMDBKey(inputTMDBKey.trim());
                        setTmdbKeySaved(true);
                        setTimeout(() => {
                          setIsTMDBKeyModalOpen(false);
                          setTmdbKeySaved(false);
                        }, 800);
                      }}
                      className="space-y-2 pt-1"
                    >
                      <div className="relative flex items-center">
                        <input
                          type={showTMDBKey ? 'text' : 'password'}
                          placeholder="Enter TMDB v3 API key..."
                          value={inputTMDBKey}
                          onChange={(e) => {
                            setInputTMDBKey(e.target.value);
                            setTmdbKeySaved(false);
                          }}
                          className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-zinc-100 dark:bg-white/4 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-xl border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTMDBKey((prev) => !prev)}
                          className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors cursor-pointer"
                          aria-label={showTMDBKey ? 'Hide API key' : 'Show API key'}
                        >
                          {showTMDBKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {tmdbKeySaved && (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-sans">
                          TMDB Key saved successfully.
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTMDBKey('');
                            setInputTMDBKey('');
                            setTmdbKeySaved(true);
                            setTimeout(() => {
                              setIsTMDBKeyModalOpen(false);
                              setTmdbKeySaved(false);
                            }, 800);
                          }}
                          className="text-[11px] text-zinc-500 hover:text-red-500 underline transition-colors cursor-pointer"
                        >
                          Clear Key
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsTMDBKeyModalOpen(false)}
                            className="py-1.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                          >
                            Save Key
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            <div className="hidden sm:block">
              <Tooltip content={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} side="bottom">
                <button
                  onClick={onToggleTheme}
                  className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/6 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                </button>
              </Tooltip>
            </div>

            <Tooltip content="Legend & Guide" kbd="?" side="bottom">
              <button
                onClick={onOpenLegend}
                className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/6 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <HelpCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </Tooltip>
          </div>

          {!isTMDBKeyModalOpen && !isUserModalOpen && (hasSearchResults || (isSearchFocused && (favorites.length > 0 || recents.length > 0 || (suiteMode !== 'anime' && !hasTMDBKey())))) && (
            <div
              ref={searchDropdownRef}
              className={`${
                hasActiveAnime
                  ? 'absolute left-1/2 -translate-x-1/2 top-full mt-2'
                  : 'relative mt-3'
              } w-[calc(100vw-32px)] sm:w-136 max-w-xl bg-white/98 dark:bg-[#0c0c0e]/95 backdrop-blur-xl border border-zinc-200/90 dark:border-white/10 rounded-2xl shadow-[0_16px_45px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150`}
            >
              {suiteMode !== 'anime' && !hasTMDBKey() ? (
                <div className="p-4 sm:p-5 text-center space-y-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                    <Key className="w-4.5 h-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                      TMDB API Key Required
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-sans leading-relaxed max-w-xs mx-auto">
                      Paaru {suiteMode === 'movies' ? 'Movies' : 'Shows'} queries The Movie Database directly. Enter your free TMDB v3 API key below.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (inputTMDBKey.trim()) {
                        setTMDBKey(inputTMDBKey.trim());
                        setTmdbKeySaved(true);
                      }
                    }}
                    className="space-y-2.5 pt-1 max-w-xs mx-auto"
                  >
                    <div className="relative flex items-center">
                      <input
                        type={showTMDBKey ? 'text' : 'password'}
                        placeholder="Paste TMDB v3 API key..."
                        value={inputTMDBKey}
                        onChange={(e) => setInputTMDBKey(e.target.value)}
                        autoFocus
                        className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-zinc-100 dark:bg-white/4 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-xl border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors text-center"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTMDBKey((prev) => !prev)}
                        className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors cursor-pointer"
                        aria-label={showTMDBKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showTMDBKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="submit"
                        disabled={!inputTMDBKey.trim()}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
                      >
                        Save Key
                      </button>
                      <a
                        href="https://www.themoviedb.org/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-medium cursor-pointer transition-colors"
                      >
                        Get Free Key
                      </a>
                    </div>
                  </form>
                </div>
              ) : hasSearchResults ? (
                <>
                  {suiteMode === 'anime' && (parsedQuery.type !== 'text' || parsedQuery.format_in || parsedQuery.seasonYear) && (
                    <div className="px-3 py-1.5 bg-zinc-100/80 dark:bg-white/4 border-b border-zinc-200/60 dark:border-white/5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-600 dark:text-zinc-300">
                      {parsedQuery.type === 'anilist_url' && (
                        <span className="flex items-center gap-1 text-zinc-950 dark:text-zinc-100">
                          <ExternalLink className="w-3 h-3" /> AniList URL (ID #{parsedQuery.id})
                        </span>
                      )}
                      {parsedQuery.type === 'mal_url' && (
                        <span className="flex items-center gap-1 text-zinc-950 dark:text-zinc-100">
                          <ExternalLink className="w-3 h-3" /> MyAnimeList URL (ID #{parsedQuery.idMal})
                        </span>
                      )}
                      {parsedQuery.type === 'numeric_id' && (
                        <span className="flex items-center gap-1 text-zinc-950 dark:text-zinc-100">
                          Direct ID Match: #{parsedQuery.id}
                        </span>
                      )}
                      {parsedQuery.format_in && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-white/10 uppercase font-semibold">
                          Format: {parsedQuery.format_in.join(', ')}
                        </span>
                      )}
                      {parsedQuery.seasonYear && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-white/10">
                          Year: {parsedQuery.seasonYear}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="max-h-85 overflow-y-auto p-2">
                    {isSearching && searchResults.length === 0 && inGraphMatches.length === 0 ? (
                      <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 dark:text-zinc-500" />
                        <span>Searching {suiteMode === 'movies' ? 'movies' : suiteMode === 'shows' ? 'TV shows' : 'anime'}...</span>
                      </div>
                    ) : searchResults.length === 0 && inGraphMatches.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                        No {suiteMode === 'movies' ? 'movies' : suiteMode === 'shows' ? 'TV shows' : 'anime'} found matching "{searchQuery}"
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {inGraphMatches.length > 0 && (
                          <div className="mb-2">
                            <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-950 dark:text-zinc-100 font-mono uppercase tracking-wider flex items-center gap-1.5">
                              <Crosshair className="w-3 h-3" />
                              In Current Graph (Jump to Node)
                            </div>
                            <div className="space-y-0.5 mt-0.5">
                              {inGraphMatches.map((node, idx) => {
                                const isSelected = selectedIndex === idx;
                                const title = node.data.title.english || node.data.title.romaji;
                                const subTitle =
                                  node.data.title.english &&
                                  node.data.title.romaji &&
                                  node.data.title.english !== node.data.title.romaji
                                    ? node.data.title.romaji
                                    : null;
                                const score = node.data.averageScore ? `${node.data.averageScore}%` : null;

                                return (
                                  <div
                                    key={`node-${node.data.id}`}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    onClick={() => {
                                      onFocusNode?.(node.data.id);
                                      setIsSearchFocused(false);
                                      setSearchQuery('');
                                      setSearchResults([]);
                                      searchInputRef.current?.blur();
                                    }}
                                    className={`p-2.5 sm:p-3 rounded-2xl cursor-pointer flex items-center gap-3 sm:gap-3.5 transition-colors ${
                                      isSelected
                                        ? 'bg-zinc-200/80 text-zinc-950 dark:bg-white/15 dark:text-white'
                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/4'
                                    }`}
                                  >
                                    <img
                                      src={typeof node.data.coverImage === 'string' ? node.data.coverImage : (node.data.coverImage?.large || node.data.coverImage?.medium)}
                                      alt=""
                                      className="w-12 h-16 sm:w-13 sm:h-18 object-cover rounded-xl bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200/90 dark:border-white/10 shadow-xs"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm sm:text-[14.5px] font-semibold truncate leading-tight flex items-center gap-1.5">
                                        <span className="truncate">{title}</span>
                                        {renderWatchlistBadge(node.data.id)}
                                      </div>
                                      {subTitle && (
                                        <div className="text-xs text-zinc-500 truncate leading-tight mt-0.5">
                                          {subTitle}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                                        <span className="uppercase font-semibold text-zinc-800 dark:text-zinc-300">
                                          {formatMediaType(node.data.format)}
                                        </span>
                                        {node.data.seasonYear && <span>• {node.data.seasonYear}</span>}
                                        {node.data.episodes && <span>• {node.data.episodes} EPS</span>}
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex flex-col items-end justify-between self-stretch py-0.5 font-mono text-xs">
                                      <div className="h-4 flex items-center pr-1">
                                        {isSelected && (
                                          <span className="flex items-center gap-1 text-zinc-950 dark:text-white font-medium animate-in fade-in duration-100">
                                            <span>Jump</span>
                                            <Crosshair className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                      </div>
                                      {score && (
                                        <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1 pr-1 font-semibold">
                                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                          {score}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {searchResults.length > 0 && (
                          <div>
                            {inGraphMatches.length > 0 && (
                              <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider flex items-center gap-1.5">
                                <Search className="w-3 h-3" />
                                {suiteMode === 'movies' ? 'Movies' : suiteMode === 'shows' ? 'TV Shows' : 'All Anime'}
                              </div>
                            )}
                            <div className="space-y-0.5 mt-0.5">
                              {searchResults.map((item, searchIdx) => {
                                const overallIndex = inGraphMatches.length + searchIdx;
                                const isSelected = overallIndex === selectedIndex;
                                const isFav = favorites.some((f) => f.id === item.id);
                                const title = item.title.english || item.title.romaji;
                                const subTitle =
                                  item.title.english &&
                                  item.title.romaji &&
                                  item.title.english !== item.title.romaji
                                    ? item.title.romaji
                                    : null;
                                const score = item.averageScore ? `${item.averageScore}%` : null;

                                return (
                                  <div
                                    key={item.id}
                                    onMouseEnter={() => setSelectedIndex(overallIndex)}
                                    onClick={() => {
                                      handleSelectMediaItem({
                                        id: item.id,
                                        title: item.title.english || item.title.romaji || 'Unknown Title',
                                        coverImage: item.coverImage?.large || item.coverImage?.medium,
                                        format: item.format,
                                        seasonYear: item.seasonYear,
                                        mode: suiteMode,
                                      });
                                    }}
                                    className={`p-2.5 sm:p-3 rounded-2xl cursor-pointer flex items-center gap-3 sm:gap-3.5 transition-colors ${
                                      isSelected
                                        ? 'bg-zinc-100 text-zinc-950 dark:bg-white/8 dark:text-white'
                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/4'
                                    }`}
                                  >
                                    <img
                                      src={item.coverImage?.large || item.coverImage?.medium}
                                      alt=""
                                      className="w-12 h-16 sm:w-13 sm:h-18 object-cover rounded-xl bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200/90 dark:border-white/10 shadow-xs"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm sm:text-[14.5px] font-semibold truncate leading-tight flex items-center gap-1.5">
                                        <span className="truncate">{title}</span>
                                        {renderWatchlistBadge(item.id)}
                                      </div>
                                      {subTitle && (
                                        <div className="text-xs text-zinc-500 truncate leading-tight mt-0.5">
                                          {subTitle}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                                        <span className="uppercase font-semibold text-zinc-800 dark:text-zinc-300">
                                          {formatMediaType(item.format)}
                                        </span>
                                        {item.seasonYear && <span>• {item.seasonYear}</span>}
                                        {suiteMode !== 'movies' && (
                                          <span>• {formatEpisodeCount(item.episodes, item.status)}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex flex-col items-end justify-between self-stretch py-0.5 font-mono text-xs">
                                      <div className="h-5 flex items-center gap-1 pr-1">
                                        <Tooltip content={isFav ? "Remove from favorites" : "Add to favorites"} side="left">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFavorite({
                                                id: item.id,
                                                title: item.title.english || item.title.romaji || 'Unknown Title',
                                                coverImage: item.coverImage?.large || item.coverImage?.medium,
                                                format: item.format,
                                                seasonYear: item.seasonYear,
                                              }, e);
                                            }}
                                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                                              isFav
                                                ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                                : 'text-zinc-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/10 opacity-70 group-hover:opacity-100'
                                            }`}
                                          >
                                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                                          </button>
                                        </Tooltip>
                                        {isSelected && (
                                          <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 animate-in fade-in duration-100 ml-1">
                                            <span>Open</span>
                                            <CornerDownLeft className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                                          </span>
                                        )}
                                      </div>
                                      {score && (
                                        <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1 pr-1 font-semibold">
                                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                          {score}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="hidden sm:flex px-4 py-2 bg-zinc-50 dark:bg-black/40 border-t border-zinc-200/80 dark:border-white/5 items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <ArrowUpDown className="w-3 h-3 text-zinc-400" /> Navigate
                      </span>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                          ↵
                        </kbd>{' '}
                        Select
                      </span>
                    </div>
                    <span>ESC to close</span>
                  </div>
                </>
              ) : (
                <div className="max-h-85 overflow-y-auto p-2 space-y-2">
                  {favorites.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        Favorites
                      </div>
                      <div className="space-y-1 mt-0.5">
                        {favorites.map((item) => (
                          <div
                            key={`fav-${item.id}`}
                            onClick={() => handleSelectMediaItem(item)}
                            className="p-2 sm:p-2.5 rounded-xl cursor-pointer flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/6 transition-colors group"
                          >
                            <img
                              src={item.coverImage}
                              alt=""
                              className="w-10 h-13.5 sm:w-11 sm:h-15 object-cover rounded-lg bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200/90 dark:border-white/10 shadow-xs"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-[13.5px] font-semibold truncate leading-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <span className="truncate">{item.title}</span>
                                {renderWatchlistBadge(item.id)}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                                <span className="uppercase font-semibold text-zinc-700 dark:text-zinc-300">
                                  {formatMediaType(item.format)}
                                </span>
                                {item.seasonYear && <span>• {item.seasonYear}</span>}
                              </div>
                            </div>
                            <Tooltip content="Remove from favorites" side="left">
                              <button
                                type="button"
                                onClick={(e) => toggleFavorite(item, e)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              >
                                <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                              </button>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recents.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          Recent Searches
                        </span>
                        <button
                          type="button"
                          onClick={clearAllRecents}
                          className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer font-sans normal-case"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1 mt-0.5">
                        {recents.map((item) => {
                          const isFav = favorites.some((f) => f.id === item.id);
                          return (
                            <div
                              key={`rec-${item.id}`}
                              onClick={() => handleSelectMediaItem(item)}
                              className="p-2 sm:p-2.5 rounded-xl cursor-pointer flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/6 transition-colors group"
                            >
                              <img
                                src={item.coverImage}
                                alt=""
                                className="w-10 h-13.5 sm:w-11 sm:h-15 object-cover rounded-lg bg-zinc-100 dark:bg-zinc-900 shrink-0 border border-zinc-200/90 dark:border-white/10 shadow-xs"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-[13.5px] font-semibold truncate leading-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                  <span className="truncate">{item.title}</span>
                                  {renderWatchlistBadge(item.id)}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                                  <span className="uppercase font-semibold text-zinc-700 dark:text-zinc-300">
                                    {formatMediaType(item.format)}
                                  </span>
                                  {item.seasonYear && <span>• {item.seasonYear}</span>}
                                </div>
                              </div>
                              <Tooltip content={isFav ? 'Remove favorite' : 'Add favorite'} side="left">
                                <button
                                  type="button"
                                  onClick={(e) => toggleFavorite(item, e)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isFav
                                      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                      : 'text-zinc-400 hover:text-rose-500 hover:bg-zinc-200 dark:hover:bg-white/10'
                                  }`}
                                >
                                  <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                                </button>
                              </Tooltip>
                              <Tooltip content="Remove from history" side="left">
                                <button
                                  type="button"
                                  onClick={(e) => removeRecent(item.id, e)}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {hasActiveAnime && !hasSearchResults && !isSearchFocused && !isFilterOpen && !isUserModalOpen && !isTMDBKeyModalOpen && (
            <div className="mt-2 sm:mt-2.5 flex flex-col items-center pointer-events-auto">
              {isLoading && progress ? (
                <div className="px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-white/10 shadow-sm flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 animate-in fade-in duration-150">
                  {progress.rateLimitSeconds ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  ) : (
                    <Loader2 className="w-3 h-3 text-zinc-400 dark:text-zinc-500 animate-spin shrink-0" />
                  )}
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {progress.loaded}/{progress.total}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="max-w-45 sm:max-w-60 truncate text-zinc-500 dark:text-zinc-400">
                    {progress.currentTitle}
                  </span>
                </div>
              ) : suiteMode === 'anime' && stats ? (
                <div className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/90 dark:bg-zinc-950/70 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-[13px] font-mono text-zinc-600 dark:text-zinc-400 select-none animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="font-semibold text-zinc-950 dark:text-zinc-100 shrink-0">
                    {stats.completedEntries}/{stats.totalEntries} Watched
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-zinc-950 dark:text-zinc-100 font-semibold shrink-0">
                    {stats.percentComplete}%
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700 hidden xs:inline">•</span>
                  <span className="hidden xs:inline truncate">
                    {stats.remainingEpisodes > 0
                      ? `${stats.remainingEpisodes} EPS (~${stats.remainingHours}h remaining)`
                      : 'Complete'}
                  </span>
                </div>
              ) : suiteMode === 'movies' && nodes && nodes.length > 0 ? (
                <div className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/90 dark:bg-zinc-950/70 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-[13px] font-mono text-zinc-600 dark:text-zinc-400 select-none animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="font-semibold text-zinc-950 dark:text-zinc-100 shrink-0">
                    {nodes.length} {nodes.length === 1 ? 'Movie' : 'Titles'}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-zinc-950 dark:text-zinc-100 font-semibold shrink-0">
                    {nodes.length > 1 ? 'Universe Timeline' : 'Movie'}
                  </span>
                </div>
              ) : suiteMode === 'shows' && nodes && nodes.length > 0 ? (
                <div className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/90 dark:bg-zinc-950/70 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-[13px] font-mono text-zinc-600 dark:text-zinc-400 select-none animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="font-semibold text-zinc-950 dark:text-zinc-100 shrink-0">
                    {nodes.length} {nodes.length === 1 ? 'Entry' : 'Entries'}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-zinc-950 dark:text-zinc-100 font-semibold shrink-0">
                    Connected Universe
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>
    </>
  );
};
