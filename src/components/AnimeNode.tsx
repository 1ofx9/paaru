import { memo, useLayoutEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Check, Star } from 'lucide-react';
import type { AnimeNodeData } from '../types/anime';
import { formatMediaType, formatEpisodeCount } from '../utils/formatters';
import { Tooltip } from './Tooltip';

interface AnimeNodeProps {
  id: string;
  data: AnimeNodeData;
  selected?: boolean;
}

export const AnimeNode = memo(({ id, data, selected }: AnimeNodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, data.viewMode, updateNodeInternals]);

  const isAnime = data.suiteMode ? data.suiteMode === 'anime' : true;
  const isCompleted = isAnime && data.watchStatus === 'COMPLETED';
  const isCurrent = isAnime && data.watchStatus === 'CURRENT';
  const isPlanning = isAnime && data.watchStatus === 'PLANNING';
  const isNextUp = isAnime && Boolean(data.isNextUp);

  const displayTitle = data.title?.english || data.title?.romaji || 'Unknown Title';
  const formattedFormat = formatMediaType(data.format);
  const episodesText =
    data.format === 'MOVIE'
      ? data.duration
        ? `${Math.floor(data.duration / 60) > 0 ? `${Math.floor(data.duration / 60)}h ` : ''}${data.duration % 60}m`
        : 'Film'
      : isCurrent && typeof data.userProgress === 'number'
      ? `${data.userProgress}/${data.episodes || '?'} EPS`
      : formatEpisodeCount(data.episodes, data.status);

  if (data.viewMode === 'compact') {
    const statusLabel = isAnime
      ? isNextUp
        ? 'Next Up'
        : isCurrent
        ? typeof data.userProgress === 'number'
          ? `Watching (${data.userProgress}/${data.episodes || '?'})`
          : 'Watching'
        : isPlanning
        ? 'Planning'
        : isCompleted
        ? 'Completed'
        : null
      : null;

    const posterTooltip = (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span>{displayTitle}</span>
        {data.seasonYear && <span className="text-zinc-400">({data.seasonYear})</span>}
        {data.averageScore && (
          <>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="inline-flex items-center gap-0.5 text-amber-400 font-semibold font-mono">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
              {(data.averageScore / 10).toFixed(1)}
            </span>
          </>
        )}
        {statusLabel && (
          <>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span>{statusLabel}</span>
          </>
        )}
      </span>
    );

    return (
      <Tooltip content={posterTooltip} side="top" delayMs={200} wrapperClassName="block">
        <div
          className={`relative group w-[80px] h-[120px] rounded-lg overflow-hidden transition-all duration-300 ease-out animate-in fade-in-0 duration-200
            bg-zinc-100 dark:bg-zinc-900 border select-none cursor-pointer
            ${
              selected || data.isDirectHover || data.isInPath
                ? 'opacity-100'
                : data.isDimmed
                ? 'opacity-25 hover:opacity-90'
                : 'opacity-100'
            }
            ${
              selected
                ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/20 dark:ring-white/40 shadow-xl scale-[1.03]'
                : data.isDirectHover
                ? 'border-zinc-400 dark:border-zinc-400 shadow-md -translate-y-0.5'
                : isNextUp
                ? 'border-[#7c3aed] dark:border-[#c4b5fd]/80 ring-2 ring-[#7c3aed]/25 dark:ring-[#c4b5fd]/40 shadow-[0_4px_16px_rgba(124,58,237,0.3)]'
                : isCurrent
                ? 'border-[#d97706] dark:border-[#fde68a]/80 ring-1 ring-[#d97706]/30 shadow-[0_4px_16px_rgba(217,119,6,0.2)]'
                : isPlanning
                ? 'border-[#0284c7] dark:border-[#bae6fd]/60'
                : isCompleted
                ? 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-[#09090b]/80'
                : 'border-zinc-200/90 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-xs hover:shadow-md'
            }
          `}
        >
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={false}
            className="w-1.5! h-1.5! bg-zinc-400! dark:bg-zinc-600! border-0! pointer-events-none!"
          />
          <Handle
            type="source"
            position={Position.Right}
            isConnectable={false}
            className="w-1.5! h-1.5! bg-zinc-400! dark:bg-zinc-600! border-0! pointer-events-none!"
          />

          {data.coverImage?.large || data.coverImage?.medium ? (
            <img
              src={data.coverImage.large || data.coverImage.medium}
              alt={displayTitle}
              className="w-full h-full object-cover pointer-events-none"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center text-zinc-400 dark:text-zinc-600 text-[9px] font-mono leading-tight">
              {displayTitle}
            </div>
          )}

          {isCompleted && (
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none">
              <div className="w-6 h-6 rounded-full bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-[#a7f3d0] stroke-[2.5]" />
              </div>
            </div>
          )}

          {isNextUp && (
            <div className="absolute top-1.5 right-1.5 flex items-center justify-center pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] dark:bg-[#c4b5fd] shadow-[0_0_8px_rgba(139,92,246,0.8)] ring-1.5 ring-white dark:ring-zinc-950" />
            </div>
          )}

          {isCurrent && (
            <div className="absolute top-1.5 right-1.5 flex items-center justify-center pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] dark:bg-[#fde68a] shadow-[0_0_8px_rgba(245,158,11,0.8)] ring-1.5 ring-white dark:ring-zinc-950" />
            </div>
          )}
        </div>
      </Tooltip>
    );
  }

  return (
    <div
      className={`relative group flex items-center w-67 h-22.5 rounded-xl px-3 py-2.5 transition-all duration-300 ease-out animate-in fade-in-0 duration-200
        bg-white dark:bg-[#09090b]/90 backdrop-blur-md border text-zinc-900 dark:text-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:shadow-xl select-none cursor-pointer
        ${
          selected || data.isDirectHover || data.isInPath
            ? 'opacity-100'
            : data.isDimmed
            ? 'opacity-25 hover:opacity-90'
            : 'opacity-100'
        }
        ${
          selected
            ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/20 dark:ring-white/40 shadow-lg'
            : data.isDirectHover
            ? 'border-zinc-400 dark:border-zinc-400 shadow-md -translate-y-0.5'
            : isNextUp
            ? 'border-[#7c3aed] dark:border-[#c4b5fd]/70 ring-2 ring-[#7c3aed]/15 dark:ring-[#c4b5fd]/30 shadow-[0_4px_16px_-2px_rgba(124,58,237,0.2)] dark:shadow-[0_0_20px_-4px_rgba(196,181,253,0.3)]'
            : isCurrent
            ? 'border-[#d97706] dark:border-[#fde68a]/70 ring-1 ring-[#d97706]/20 shadow-[0_4px_16px_-2px_rgba(217,119,6,0.15)] dark:shadow-[0_0_15px_-4px_rgba(253,230,138,0.14)]'
            : isPlanning
            ? 'border-[#0284c7] dark:border-[#bae6fd]/50 shadow-[0_4px_16px_-2px_rgba(2,132,199,0.15)] dark:shadow-none'
            : isCompleted
            ? 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-[#09090b]/80'
            : 'border-zinc-200/90 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600'
        }
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="w-1.5! h-1.5! bg-zinc-400! dark:bg-zinc-600! border-0! pointer-events-none!"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="w-1.5! h-1.5! bg-zinc-400! dark:bg-zinc-600! border-0! pointer-events-none!"
      />

      <div className="relative shrink-0 w-11 h-15 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 mr-3 border border-black/[0.06] dark:border-white/5">
        {data.coverImage?.medium || data.coverImage?.large ? (
          <img
            src={data.coverImage.medium || data.coverImage.large}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-[8px] font-mono">
            —
          </div>
        )}

        {isCompleted && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[0.5px] flex items-center justify-center">
            <Check className="w-4 h-4 text-[#a7f3d0] stroke-[2.5]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[10.5px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 leading-none">
          <span className="font-semibold text-zinc-900 dark:text-zinc-300">
            {formattedFormat}
          </span>
          <span className="text-zinc-400 dark:text-zinc-600">•</span>
          <span className="text-zinc-600 dark:text-zinc-400">
            {episodesText}
          </span>
          {data.averageScore && (
            <span className="text-zinc-800 dark:text-zinc-300 ml-auto font-mono font-medium inline-flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
              {(data.averageScore / 10).toFixed(1)}
            </span>
          )}
        </div>

        <div className="min-w-0 my-0.5">
          <Tooltip content={displayTitle} side="top" delayMs={250} wrapperClassName="min-w-0 max-w-full">
            <h4 className="font-heading text-[12.5px] sm:text-[13px] font-semibold tracking-tight truncate leading-tight text-zinc-950 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
              {displayTitle}
            </h4>
          </Tooltip>
        </div>

        <div className="flex items-center justify-between text-[10px] sm:text-[10.5px] font-mono pt-1 border-t border-zinc-100 dark:border-white/5 leading-none">
          <div className="flex items-center gap-1.5 uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {isAnime ? (
              isNextUp ? (
                <span className="flex items-center gap-1 font-semibold text-[#6d28d9] dark:text-[#c4b5fd]">
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6] dark:bg-[#c4b5fd]" />
                  Next Up
                </span>
              ) : isCurrent ? (
                <span className="flex items-center gap-1 font-medium text-amber-950 dark:text-zinc-200">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b] dark:bg-[#fde68a]" />
                  Watching
                  {typeof data.userProgress === 'number' && (
                    <span className="text-zinc-600 dark:text-zinc-400 font-mono text-[9.5px] font-normal lowercase">
                      ({data.userProgress}/{data.episodes || '?'})
                    </span>
                  )}
                </span>
              ) : isPlanning ? (
                <span className="flex items-center gap-1 font-medium text-sky-950 dark:text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-[#0284c7] dark:bg-[#bae6fd]" />
                  Planning
                </span>
              ) : isCompleted ? (
                <span className="flex items-center gap-1 font-medium text-emerald-950 dark:text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-[#059669] dark:bg-[#a7f3d0]" />
                  Completed
                </span>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-500 font-medium">Unwatched</span>
              )
            ) : data.genres && data.genres.length > 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[130px]">
                {data.genres[0]}
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-600 font-mono">
                {data.format === 'MOVIE' ? 'Movie' : 'Series'}
              </span>
            )}
          </div>

          {data.seasonYear && (
            <span className="text-zinc-400 dark:text-zinc-500 font-mono">
              {data.seasonYear}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

AnimeNode.displayName = 'AnimeNode';
