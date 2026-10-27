import React, { useEffect } from 'react';
import { X, ExternalLink, Star, Calendar, Building2, Check, Film, Tv } from 'lucide-react';
import type { AnimeNodeData } from '../types/anime';
import type { SuiteMode } from '../types/media';
import { formatMediaType, formatEpisodeCount, formatSynopsis } from '../utils/formatters';
import { Tooltip } from './Tooltip';

interface DetailSheetProps {
  media: AnimeNodeData | null;
  onClose: () => void;
  suiteMode?: SuiteMode;
}

export const DetailSheet: React.FC<DetailSheetProps> = ({
  media,
  onClose,
  suiteMode = 'anime',
}) => {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!media) return null;

  const isMovieSuite = suiteMode === 'movies' || media.format === 'MOVIE' && suiteMode !== 'anime';
  const isShowSuite = suiteMode === 'shows';
  const isAnimeSuite = suiteMode === 'anime';

  const englishTitle = media.title?.english;
  const romajiTitle = media.title?.romaji;
  const nativeTitle = media.title?.native;
  const primaryTitle = englishTitle || romajiTitle || 'Unknown Title';

  const mainStudio =
    media.studios?.edges?.find((e) => e.isMain)?.node?.name ||
    media.studios?.edges?.[0]?.node?.name;

  const isCompleted = media.watchStatus === 'COMPLETED';
  const isCurrent = media.watchStatus === 'CURRENT';
  const isPlanning = media.watchStatus === 'PLANNING';
  const isNextUp = media.isNextUp;

  const cleanDescription = formatSynopsis(media.description);

  const formattedRuntime = media.duration
    ? `${Math.floor(media.duration / 60) > 0 ? `${Math.floor(media.duration / 60)}h ` : ''}${media.duration % 60}m`
    : 'Feature';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto flex flex-col justify-end sm:justify-start">
      <div
        className="absolute inset-0 bg-black/40 sm:bg-black/20 dark:bg-black/50 sm:dark:bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:inset-y-0 sm:right-0 max-w-full flex sm:pl-6 pointer-events-none">
        <div className="w-full sm:w-screen sm:max-w-md max-h-[90vh] sm:max-h-full rounded-t-3xl sm:rounded-none bg-white dark:bg-[#0c0c0e] border-t sm:border-t-0 sm:border-l border-zinc-200/90 dark:border-white/10 shadow-2xl flex flex-col text-zinc-900 dark:text-zinc-100 relative pointer-events-auto overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
          <div className="sm:hidden absolute top-2 inset-x-0 mx-auto w-10 h-1 rounded-full bg-white/40 backdrop-blur-sm z-30" />

          <Tooltip content="Close (Esc)" side="left">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>

          <div className="relative h-36 sm:h-44 w-full bg-zinc-900 shrink-0 overflow-hidden">
            {media.bannerImage ? (
              <img
                src={media.bannerImage}
                alt=""
                className="w-full h-full object-cover opacity-60 dark:opacity-45 scale-105"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-zinc-800 to-zinc-950" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-white via-white/50 to-transparent dark:from-[#0c0c0e] dark:via-[#0c0c0e]/60" />
          </div>

          <div className="px-5 -mt-16 relative z-10 flex gap-4 items-end pb-3">
            <div className="w-24 sm:w-28 aspect-2/3 rounded-2xl overflow-hidden bg-zinc-900 border-2 border-white dark:border-white/15 shadow-2xl shrink-0">
              <img
                src={media.coverImage?.large || media.coverImage?.medium}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 pb-1">
              {isAnimeSuite ? (
                isNextUp ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/25 text-[#6d28d9] dark:text-[#c4b5fd] text-[11px] font-mono font-medium mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#8b5cf6] dark:bg-[#c4b5fd]" />
                    Next Up
                  </div>
                ) : isCurrent ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-mono font-medium mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b] dark:bg-[#fde68a]" />
                    Watching
                    {typeof media.userProgress === 'number' && (
                      <span className="opacity-80 font-normal">
                        ({media.userProgress}/{media.episodes || '?'})
                      </span>
                    )}
                  </div>
                ) : isCompleted ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-medium mb-1.5">
                    <Check className="w-3 h-3 text-[#059669] dark:text-[#a7f3d0] stroke-[2.5]" />
                    Completed
                  </div>
                ) : isPlanning ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-mono font-medium mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0284c7] dark:bg-[#bae6fd]" />
                    Planning
                  </div>
                ) : null
              ) : isCompleted ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-medium mb-1.5">
                  <Check className="w-3 h-3 text-[#059669] dark:text-[#a7f3d0] stroke-[2.5]" />
                  Watched
                </div>
              ) : isMovieSuite ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/8 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono font-medium mb-1.5">
                  <Film className="w-3 h-3 text-zinc-500" />
                  Feature Film
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/8 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono font-medium mb-1.5">
                  <Tv className="w-3 h-3 text-zinc-500" />
                  Television Series
                </div>
              )}

              <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white leading-snug line-clamp-2">
                {primaryTitle}
              </h2>

              {isAnimeSuite && englishTitle && romajiTitle && englishTitle !== romajiTitle && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {romajiTitle}
                </p>
              )}
              {isAnimeSuite && nativeTitle && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate font-mono mt-0.5">
                  {nativeTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            {isMovieSuite ? (
              <div className="grid grid-cols-4 gap-2 text-center p-2.5 rounded-2xl bg-zinc-50 dark:bg-white/4 border border-zinc-200/80 dark:border-white/10 font-mono">
                <div className="flex flex-col items-center justify-center py-1">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Runtime
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {formattedRuntime}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Released
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {media.seasonYear || '—'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Rating
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    {media.averageScore ? `${(media.averageScore / 10).toFixed(1)}` : '—'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Format
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    Movie
                  </span>
                </div>
              </div>
            ) : isShowSuite ? (
              <div className="grid grid-cols-4 gap-2 text-center p-2.5 rounded-2xl bg-zinc-50 dark:bg-white/4 border border-zinc-200/80 dark:border-white/10 font-mono">
                <div className="flex flex-col items-center justify-center py-1">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Episodes
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {media.episodes ? `${media.episodes} EPS` : 'Season'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Year
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {media.seasonYear || '—'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Rating
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    {media.averageScore ? `${(media.averageScore / 10).toFixed(1)}` : '—'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Type
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {media.format === 'SPECIAL' ? 'Special' : 'Series'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center p-2.5 rounded-2xl bg-zinc-50 dark:bg-white/4 border border-zinc-200/80 dark:border-white/10 font-mono">
                <div className="flex flex-col items-center justify-center py-1">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Format
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {formatMediaType(media.format)}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    {media.format === 'MOVIE' ? 'Runtime' : 'Episodes'}
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {media.format === 'MOVIE'
                      ? formattedRuntime
                      : isCurrent && typeof media.userProgress === 'number'
                      ? `${media.userProgress}/${media.episodes || '?'}`
                      : formatEpisodeCount(media.episodes, media.status)}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Score
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    {media.averageScore ? `${media.averageScore}%` : '—'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-1 border-l border-zinc-200 dark:border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
                    Year
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    {media.seasonYear || '—'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-white/2 border border-zinc-200/80 dark:border-white/5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-500 block leading-tight font-mono">
                    {isMovieSuite ? 'Release Year' : isShowSuite ? 'Broadcast' : 'Season'}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-200 capitalize truncate block">
                    {isAnimeSuite && media.season ? `${media.season.toLowerCase()} ` : ''}
                    {media.seasonYear || '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-white/2 border border-zinc-200/80 dark:border-white/5">
                <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-500 block leading-tight font-mono">
                    {isMovieSuite ? 'Studio / Production' : isShowSuite ? 'Network' : 'Studio'}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-200 truncate block">
                    {mainStudio || (isMovieSuite ? 'Cinema Release' : isShowSuite ? 'Broadcast Network' : '—')}
                  </span>
                </div>
              </div>
            </div>

            {media.genres && media.genres.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-semibold">
                  Genres
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {media.genres.map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium font-sans"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-semibold">
                {isMovieSuite ? 'Plot Summary' : isShowSuite ? 'Overview' : 'Synopsis'}
              </span>
              <p className="text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed font-normal whitespace-pre-line">
                {cleanDescription}
              </p>
            </div>

            {media.trailer && media.trailer.site === 'youtube' && Boolean(media.trailer.id) && /^[a-zA-Z0-9_-]+$/.test(media.trailer.id!) && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-semibold">
                  Official Trailer
                </span>
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-black shadow-md">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${media.trailer.id}`}
                    title="Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-zinc-200/90 dark:border-white/10 bg-zinc-50/90 dark:bg-[#0c0c0e] flex items-center gap-2">
            {isMovieSuite || isShowSuite ? (
              <a
                href={media.siteUrl || `https://www.themoviedb.org/search?query=${encodeURIComponent(primaryTitle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200/90 dark:border-white/10 text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shadow-xs"
              >
                <span>View on TMDB</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            ) : (
              <>
                {media.siteUrl && (
                  <a
                    href={media.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200/90 dark:border-white/10 text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shadow-xs"
                  >
                    <span>AniList</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                )}
                {media.idMal && (
                  <a
                    href={`https://myanimelist.net/anime/${media.idMal}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200/90 dark:border-white/10 text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shadow-xs"
                  >
                    <span>MyAnimeList</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
