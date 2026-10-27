import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

export interface AnimeEdgeData {
  points?: Array<{ x: number; y: number }>;
  label?: string;
  isSequel?: boolean;
  isSpinOff?: boolean;
  isAlternative?: boolean;
  theme?: 'dark' | 'light';
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

function smoothArchPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  apexX: number,
  apexY: number
): string {
  const dx1 = apexX - sourceX;
  const c1x = sourceX + dx1 * 0.45;
  const c1y = sourceY;
  const c2x = apexX - dx1 * 0.45;
  const c2y = apexY;

  const dx2 = targetX - apexX;
  const c3x = apexX + dx2 * 0.45;
  const c3y = apexY;
  const c4x = targetX - dx2 * 0.45;
  const c4y = targetY;

  return `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${apexX} ${apexY} C ${c3x} ${c3y}, ${c4x} ${c4y}, ${targetX} ${targetY}`;
}

export const AnimeEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
}: EdgeProps) => {
  const edgeData = data as AnimeEdgeData | undefined;

  const [bezierPath, defaultLabelX, defaultLabelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const hasMultiRank = Boolean(edgeData?.points && edgeData.points.length > 3);
  let edgePath = bezierPath;
  let finalLabelX = defaultLabelX;
  let finalLabelY = defaultLabelY;

  if (hasMultiRank && edgeData?.points) {
    const intermediate = edgeData.points.slice(1, -1);
    const baseY = (sourceY + targetY) / 2;
    const minPtY = Math.min(...intermediate.map((p) => p.y));
    const maxPtY = Math.max(...intermediate.map((p) => p.y));

    const peakY =
      Math.abs(minPtY - baseY) > Math.abs(maxPtY - baseY) ? minPtY : maxPtY;

    if (Math.abs(peakY - baseY) > 24) {
      const apexX = (sourceX + targetX) / 2;
      const apexY = peakY;
      edgePath = smoothArchPath(sourceX, sourceY, targetX, targetY, apexX, apexY);
      finalLabelX = apexX;
      finalLabelY = apexY;
    }
  }

  const labelText = edgeData?.label;
  const isSequel = edgeData?.isSequel;
  const isSpinOff = edgeData?.isSpinOff;
  const isAlternative = edgeData?.isAlternative;
  const theme = edgeData?.theme ?? 'dark';

  const isHighlighted = edgeData?.isHighlighted;
  const isDimmed = edgeData?.isDimmed;

  const edgeStyle = {
    ...style,
    opacity: isDimmed ? 0.15 : isHighlighted ? 1 : style?.opacity,
    strokeWidth: isHighlighted ? ((style?.strokeWidth as number) || 2) + 1.25 : style?.strokeWidth,
    filter: isHighlighted
      ? theme === 'dark'
        ? isSequel
          ? 'drop-shadow(0 0 5px rgba(196,181,253,0.75))'
          : isSpinOff
          ? 'drop-shadow(0 0 5px rgba(167,243,208,0.75))'
          : 'drop-shadow(0 0 5px rgba(254,215,170,0.75))'
        : isSequel
        ? 'drop-shadow(0 0 4px rgba(124,58,237,0.5))'
        : isSpinOff
        ? 'drop-shadow(0 0 4px rgba(5,150,105,0.5))'
        : 'drop-shadow(0 0 4px rgba(234,88,12,0.5))'
      : undefined,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />
      {labelText && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${finalLabelX}px, ${finalLabelY}px)`,
              pointerEvents: 'none',
              opacity: isDimmed ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
            }}
            className="nodrag nopan z-10"
          >
            <div
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-medium tracking-wide border select-none transition-all whitespace-nowrap shadow-sm backdrop-blur-md ${
                theme === 'light'
                  ? 'bg-white/95 text-zinc-800 border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'bg-[#09090b]/90 text-zinc-300 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
              }`}
              style={{
                borderColor: isSequel
                  ? (theme === 'light' ? '#c4b5fd' : '#7c3aed60')
                  : isSpinOff
                  ? (theme === 'light' ? '#a7f3d0' : '#05966960')
                  : isAlternative
                  ? (theme === 'light' ? '#fed7aa' : '#ea580c60')
                  : undefined,
              }}
            >
              {labelText}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

AnimeEdge.displayName = 'AnimeEdge';
