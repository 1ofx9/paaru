import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, Home, Share2, Check, LayoutGrid, Columns } from 'lucide-react';
import type { ViewMode } from '../types/anime';
import type { SuiteMode } from '../types/media';
import { Tooltip } from './Tooltip';

interface CanvasControlsProps {
  onCenterNextUp?: () => void;
  hasNextUp?: boolean;
  onResetToEmpty?: () => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  suiteMode?: SuiteMode;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  onCenterNextUp,
  hasNextUp,
  onResetToEmpty,
  viewMode,
  onToggleViewMode,
  suiteMode = 'anime',
}) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 right-4 sm:right-6 z-30 flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white/95 dark:bg-zinc-950/70 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-2xl pointer-events-auto transition-colors">
      {onResetToEmpty && (
        <div className="hidden sm:flex sm:items-center">
          <Tooltip content="Back to search" kbd="Esc">
            <button
              onClick={onResetToEmpty}
              className="w-9.5 h-9.5 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Home className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
          <div className="w-px h-5 bg-zinc-200 dark:bg-white/10 mx-0.5" />
        </div>
      )}

      <Tooltip content={viewMode === 'compact' ? 'Detailed View' : 'Poster View'}>
        <button
          onClick={onToggleViewMode}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            viewMode === 'compact'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
              : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          {viewMode === 'compact' ? <Columns className="w-4.5 h-4.5" /> : <LayoutGrid className="w-4.5 h-4.5" />}
        </button>
      </Tooltip>

      <Tooltip content={copied ? 'Link Copied!' : 'Share Timeline'}>
        <button
          onClick={handleShare}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer relative"
        >
          {copied ? (
            <Check className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Share2 className="w-4.5 h-4.5" />
          )}
        </button>
      </Tooltip>

      <div className="hidden sm:block w-px h-5 bg-zinc-200 dark:bg-white/10 mx-0.5" />

      <div className="hidden sm:contents">
        <Tooltip content="Zoom In">
          <button
            onClick={() => zoomIn({ duration: 250 })}
            className="w-9.5 h-9.5 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4.5 h-4.5" />
          </button>
        </Tooltip>

        <Tooltip content="Zoom Out">
          <button
            onClick={() => zoomOut({ duration: 250 })}
            className="w-9.5 h-9.5 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4.5 h-4.5" />
          </button>
        </Tooltip>
      </div>

      <Tooltip content="Fit View">
        <button
          onClick={() => fitView({ padding: 0.12, minZoom: 0.65, maxZoom: 1.25, duration: 350 })}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>
      </Tooltip>

      {suiteMode === 'anime' && hasNextUp && onCenterNextUp && (
        <Tooltip content="Jump to Next Up">
          <button
            onClick={onCenterNextUp}
            className="px-3 h-8.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-white/8 dark:hover:bg-white/[0.14] text-zinc-800 dark:text-zinc-100 text-xs font-mono flex items-center gap-1.5 transition-colors border border-zinc-200 dark:border-white/10 ml-0.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] dark:bg-[#c4b5fd]" />
            <span>Next</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
};
