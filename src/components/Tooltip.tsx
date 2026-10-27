import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  delayMs?: number;
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  kbd?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  sideOffset = 6,
  delayMs = 120,
  className = '',
  wrapperClassName = '',
  disabled = false,
  kbd,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [resolvedSide, setResolvedSide] = useState<'top' | 'bottom' | 'left' | 'right'>(side);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const handleMouseEnter = useCallback(() => {
    if (disabled || !content || isTouchDevice) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
  }, [clearTimer, delayMs, disabled, content, isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    setIsVisible(false);
    setCoords(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  useEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      setIsVisible(false);
      setCoords(null);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible]);

  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let currentSide = side;

    if (side === 'top') {
      top = triggerRect.top - tooltipRect.height - sideOffset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      if (top < 8) {
        top = triggerRect.bottom + sideOffset;
        currentSide = 'bottom';
      }
    } else if (side === 'bottom') {
      top = triggerRect.bottom + sideOffset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      if (top + tooltipRect.height > window.innerHeight - 8) {
        top = triggerRect.top - tooltipRect.height - sideOffset;
        currentSide = 'top';
      }
    } else if (side === 'left') {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - sideOffset;
      if (left < 8) {
        left = triggerRect.right + sideOffset;
        currentSide = 'right';
      }
    } else if (side === 'right') {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + sideOffset;
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = triggerRect.left - tooltipRect.width - sideOffset;
        currentSide = 'left';
      }
    }

    left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, top));

    setResolvedSide(currentSide);
    setCoords({ top, left });
  }, [isVisible, side, sideOffset]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center ${wrapperClassName}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onClick={handleMouseLeave}
      >
        {children}
      </span>

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            data-side={resolvedSide}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              opacity: coords ? 1 : 0,
              zIndex: 9999,
            }}
            className={`pointer-events-none select-none px-2.5 py-1.5 rounded-lg text-[11.5px] font-sans font-medium tracking-normal text-zinc-100 bg-[#0c0c0e]/95 dark:bg-[#121216]/95 backdrop-blur-md border border-white/12 dark:border-white/15 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5)] flex items-center gap-1.5 max-w-[340px] ${className}`}
          >
            <span className="truncate">{content}</span>
            {kbd && (
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/12 border border-white/20 text-[9.5px] font-mono font-medium text-zinc-300 uppercase leading-none shadow-xs">
                {kbd}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
