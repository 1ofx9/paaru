import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { AnimeNodeData, GraphFilterOptions, RelationType, ViewMode } from '../types/anime';
import type { RawEdge } from '../api/crawler';
import type { SuiteMode } from '../types/media';

export const NODE_WIDTH = 268;
export const NODE_HEIGHT = 90;
export const COMPACT_NODE_WIDTH = 208;
export const COMPACT_NODE_HEIGHT = 50;
export const POSTER_NODE_WIDTH = 80;
export const POSTER_NODE_HEIGHT = 120;

export interface LayoutResult {
  nodes: Node<AnimeNodeData>[];
  edges: Edge[];
}

export function buildDagreLayout(
  mediaMap: Map<number, AnimeNodeData>,
  rawEdges: RawEdge[],
  filters: GraphFilterOptions,
  viewMode: ViewMode = 'detailed',
  theme: 'dark' | 'light' = 'dark',
  suiteMode: SuiteMode = 'anime',
  rootMediaId?: number | null
): LayoutResult {
  const filteredMediaMap = new Map(mediaMap);
  let filteredEdges = [...rawEdges];

  const nodeWidth = viewMode === 'compact' ? POSTER_NODE_WIDTH : NODE_WIDTH;
  const nodeHeight = viewMode === 'compact' ? POSTER_NODE_HEIGHT : NODE_HEIGHT;

  if (filters.hideSpecials) {
    filteredMediaMap.forEach((media, id) => {
      const fmt = media.format?.toUpperCase();
      if (fmt === 'SPECIAL' || fmt === 'MUSIC') {
        filteredMediaMap.delete(id);
      }
    });
  }

  if (filters.releasedOnly) {
    const currentYear = new Date().getFullYear();
    filteredMediaMap.forEach((media, id) => {
      const isFutureYear = Boolean(media.seasonYear && media.seasonYear > currentYear);
      const isUnreleasedStatus = media.status === 'NOT_YET_RELEASED';
      if (isFutureYear || isUnreleasedStatus) {
        filteredMediaMap.delete(id);
      }
    });
  }

  if (filters.hideSpinOffs) {
    filteredEdges = filteredEdges.filter(
      (e) => e.type !== 'SPIN_OFF' && e.type !== 'SIDE_STORY'
    );
  }

  if (filters.mainStoryOnly) {
    filteredEdges = filteredEdges.filter(
      (e) => e.type === 'SEQUEL' || e.type === 'PREQUEL'
    );
  }

  const connectedNodeIds = new Set<number>();
  filteredEdges.forEach((e) => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });

  if ((filters.mainStoryOnly || filters.hideSpinOffs) && connectedNodeIds.size > 0) {
    filteredMediaMap.forEach((_, id) => {
      if (!connectedNodeIds.has(id)) {
        if (filteredMediaMap.size > 1) {
          filteredMediaMap.delete(id);
        }
      }
    });
  }

  if (filters.unwatchedOnly) {
    const hasUnwatched = Array.from(filteredMediaMap.values()).some(
      (m) => m.watchStatus !== 'COMPLETED'
    );
    if (hasUnwatched) {
      filteredMediaMap.forEach((media, id) => {
        if (media.watchStatus === 'COMPLETED') {
          filteredMediaMap.delete(id);
        }
      });
      filteredEdges = filteredEdges.filter(
        (e) => filteredMediaMap.has(e.source) && filteredMediaMap.has(e.target)
      );
    }
  }

  const validEdges = filteredEdges.filter(
    (e) => filteredMediaMap.has(e.source) && filteredMediaMap.has(e.target)
  );

  const getMediaTimestamp = (media: AnimeNodeData): number => {
    const year = media.seasonYear || (media.startDate as { year?: number } | undefined)?.year || 9999;
    const month = (media.startDate as { month?: number } | undefined)?.month || 1;
    const day = (media.startDate as { day?: number } | undefined)?.day || 1;
    return year * 10000 + month * 100 + day;
  };

  const orderMode = filters.orderMode || 'chronological';

  // Normalize edge directions based on the chosen ordering mode:
  // - In 'release' mode, flow earlier public release -> later public release
  // - In 'chronological' mode, flow in-universe story progression (prequels -> sequels -> side stories)
  const getRelationPriority = (t: string): number => {
    switch (t) {
      case 'SEQUEL':
      case 'PREQUEL':
        return 10;
      case 'SIDE_STORY':
      case 'SPIN_OFF':
        return 7;
      case 'ALTERNATIVE':
        return 5;
      case 'PARENT':
        return 3;
      default:
        return 1;
    }
  };

  const pairEdges = new Map<string, RawEdge>();

  for (const edge of validEdges) {
    let source = edge.source;
    let target = edge.target;
    let type = edge.type;

    if (source === target) continue;

    const mediaA = filteredMediaMap.get(source);
    const mediaB = filteredMediaMap.get(target);
    if (!mediaA || !mediaB) continue;

    const timeA = getMediaTimestamp(mediaA);
    const timeB = getMediaTimestamp(mediaB);

    if (orderMode === 'release') {
      if (timeB < timeA) {
        source = edge.target;
        target = edge.source;
        if (type === 'SEQUEL') type = 'PREQUEL';
        else if (type === 'PREQUEL') type = 'SEQUEL';
      }
    } else {
      if (type === 'PREQUEL') {
        source = edge.target;
        target = edge.source;
        type = 'SEQUEL';
      }
    }

    const pairKey = source < target ? `${source}:${target}` : `${target}:${source}`;
    const existing = pairEdges.get(pairKey);

    if (!existing) {
      pairEdges.set(pairKey, { source, target, type });
    } else {
      const currPrio = getRelationPriority(type);
      const existPrio = getRelationPriority(existing.type);
      if (currPrio > existPrio) {
        pairEdges.set(pairKey, { source, target, type });
      }
    }
  }

  const normalizedEdges: RawEdge[] = Array.from(pairEdges.values());

  // Transitive reduction: remove redundant bypass edges so lines don't clutter
  const adj = new Map<number, number[]>();
  for (const edge of normalizedEdges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }

  function hasAlternativePath(from: number, to: number): boolean {
    const initialNeighbors = adj.get(from);
    if (!initialNeighbors || initialNeighbors.length <= 1) return false;

    const visited = new Set<number>();
    const queue: number[] = [];

    for (const n of initialNeighbors) {
      if (n !== to) {
        visited.add(n);
        queue.push(n);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      if (curr === to) return true;

      const nextNodes = adj.get(curr);
      if (nextNodes) {
        for (const next of nextNodes) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
    }
    return false;
  }

  const reducedEdges: RawEdge[] = [];
  for (const edge of normalizedEdges) {
    if (hasAlternativePath(edge.source, edge.target)) {
      continue;
    }
    reducedEdges.push(edge);
  }

  // Identify canon nodes (connected via SEQUEL or PREQUEL) to keep main canon along center spine
  const canonNodeIds = new Set<number>();
  if (rootMediaId) canonNodeIds.add(rootMediaId);
  reducedEdges.forEach((e) => {
    if (e.type === 'SEQUEL' || e.type === 'PREQUEL') {
      canonNodeIds.add(e.source);
      canonNodeIds.add(e.target);
    }
  });

  const nodesep = viewMode === 'compact' ? 24 : 32;
  const ranksep = viewMode === 'compact' ? 36 : 48;

  // Initialize Dagre graph
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep,
    ranksep,
    ranker: 'network-simplex',
  });

  filteredMediaMap.forEach((media) => {
    g.setNode(media.id.toString(), { width: nodeWidth, height: nodeHeight });
  });

  // Calculate dynamic capacity per column based on graph size
  const totalNodes = filteredMediaMap.size;
  let maxPerCol = 3;
  if (totalNodes > 40) {
    maxPerCol = viewMode === 'compact' ? 6 : 5;
  } else if (totalNodes > 24) {
    maxPerCol = viewMode === 'compact' ? 5 : 4;
  } else if (totalNodes > 12) {
    maxPerCol = 4;
  } else {
    maxPerCol = 3;
  }

  // Separate canon spine edges from side story / leaf edges
  const sideStoriesByParent = new Map<number, Array<{ edge: RawEdge; media: AnimeNodeData }>>();
  const spineEdges: RawEdge[] = [];

  reducedEdges.forEach((e) => {
    const isCanon = e.type === 'SEQUEL' || e.type === 'PREQUEL';
    if (!isCanon) {
      if (!sideStoriesByParent.has(e.source)) sideStoriesByParent.set(e.source, []);
      const targetMedia = filteredMediaMap.get(e.target);
      if (targetMedia) sideStoriesByParent.get(e.source)!.push({ edge: e, media: targetMedia });
    } else {
      spineEdges.push(e);
    }
  });

  // Insert canon spine edges with heavy weight so main story stays straight and taut
  spineEdges.forEach((edge, idx) => {
    try {
      g.setEdge(
        edge.source.toString(),
        edge.target.toString(),
        { width: 25, height: 25, weight: 25, minlen: 1 },
        `spine_${idx}`
      );
    } catch (err) {
      console.warn('Dagre spine edge warning:', err);
    }
  });

  // Chunk side stories attached to parents across ranks using minlen
  // This prevents 20-30 side stories from stacking into a vertical skyscraper,
  // while letting Dagre perform Sugiyama crossing minimization and parent alignment!
  let sideEdgeCounter = 0;
  sideStoriesByParent.forEach((items, parentId) => {
    items.sort((a, b) => getMediaTimestamp(a.media) - getMediaTimestamp(b.media));

    items.forEach((item, idx) => {
      const rankOffset = Math.floor(idx / maxPerCol) + 1;
      try {
        g.setEdge(
          parentId.toString(),
          item.edge.target.toString(),
          { width: 20, height: 20, weight: 1, minlen: rankOffset },
          `side_${sideEdgeCounter++}`
        );
      } catch (err) {
        console.warn('Dagre side edge warning:', err);
      }
    });
  });

  try {
    dagre.layout(g);
  } catch (err) {
    console.warn('Dagre layout fallback:', err);
  }

  // Vertical lane priority:
  // 0: Feature Movies (top lane)
  // 1: Canon Television & main storyline (center spine)
  // 2: Spin-offs, Specials, OVAs, ONAs (lower lane)
  const formatPriority = (media?: AnimeNodeData): number => {
    if (!media) return 2;
    const fmt = media.format?.toUpperCase();
    if (fmt === 'MOVIE') return 0;
    const isCanon = canonNodeIds.has(media.id);
    if (fmt === 'TV' && isCanon) return 1;
    return 2;
  };

  // Group nodes by their Dagre-computed rank (X coordinate)
  const rankBuckets = new Map<number, number[]>();
  filteredMediaMap.forEach((media) => {
    const meta = g.node(media.id.toString());
    const x = meta && Number.isFinite(meta.x) ? Math.round(meta.x / 10) * 10 : 0;
    if (!rankBuckets.has(x)) rankBuckets.set(x, []);
    rankBuckets.get(x)!.push(media.id);
  });

  const slotHeight = nodeHeight + nodesep;
  const maxRankItems = Math.max(...Array.from(rankBuckets.values()).map((items) => items.length), 1);
  const baselineY = 130 + ((maxRankItems - 1) * slotHeight) / 2;

  // Position nodes vertically centered around baselineY per rank
  const finalPositions = new Map<number, { x: number; y: number }>();

  rankBuckets.forEach((itemIds, colX) => {
    itemIds.sort((aId, bId) => {
      const mA = filteredMediaMap.get(aId);
      const mB = filteredMediaMap.get(bId);
      const pA = formatPriority(mA);
      const pB = formatPriority(mB);
      if (pA !== pB) return pA - pB;
      return getMediaTimestamp(mA!) - getMediaTimestamp(mB!);
    });

    const totalHeight = (itemIds.length - 1) * slotHeight;
    const startY = baselineY - totalHeight / 2;

    itemIds.forEach((id, idx) => {
      finalPositions.set(id, {
        x: colX - nodeWidth / 2,
        y: startY + idx * slotHeight,
      });
    });
  });

  // Global margin shifts: ensure no node is clipped or behind header
  let globalMinX = Infinity;
  let globalMinY = Infinity;
  finalPositions.forEach((pos) => {
    globalMinX = Math.min(globalMinX, pos.x);
    globalMinY = Math.min(globalMinY, pos.y);
  });

  const shiftX = globalMinX < 60 ? 60 - globalMinX : 0;
  const shiftY = globalMinY < 130 ? 130 - globalMinY : 0;

  finalPositions.forEach((pos, id) => {
    finalPositions.set(id, {
      x: pos.x + shiftX,
      y: pos.y + shiftY,
    });
  });

  const nodes: Node<AnimeNodeData>[] = Array.from(filteredMediaMap.values()).map((media, idx) => {
    const pos = finalPositions.get(media.id) || {
      x: 60 + idx * (nodeWidth + ranksep),
      y: 130,
    };

    return {
      id: media.id.toString(),
      type: 'animeNode',
      position: { x: pos.x, y: pos.y },
      width: nodeWidth,
      height: nodeHeight,
      measured: {
        width: nodeWidth,
        height: nodeHeight,
      },
      data: {
        ...media,
        suiteMode: media.suiteMode || suiteMode,
        isNextUp: (media.suiteMode || suiteMode) === 'anime' ? Boolean(media.isNextUp) : false,
        isSearchedRoot: rootMediaId ? media.id === rootMediaId : false,
        viewMode,
      },
    };
  });

  const formattedEdges: Edge[] = reducedEdges.map((e, index) => {
    const isSequel = e.type === 'SEQUEL';
    const isPrequel = e.type === 'PREQUEL';
    const isSpinOff = e.type === 'SPIN_OFF' || e.type === 'SIDE_STORY';
    const isAlternative = e.type === 'ALTERNATIVE';

    const label = isSequel 
      ? 'Sequel' 
      : isPrequel
      ? 'Prequel'
      : e.type === 'SIDE_STORY' 
      ? 'Side Story' 
      : e.type === 'SPIN_OFF' 
      ? 'Spin-off' 
      : e.type === 'ALTERNATIVE' 
      ? 'Alternative' 
      : (e.type as RelationType).replace('_', ' ');

    const strokeColor = (isSequel || isPrequel)
      ? (theme === 'light' ? '#8b5cf6' : '#c4b5fd')
      : isSpinOff 
      ? (theme === 'light' ? '#059669' : '#a7f3d0')
      : isAlternative 
      ? (theme === 'light' ? '#ea580c' : '#fed7aa')
      : (theme === 'light' ? '#64748b' : '#94a3b8');

    const edgeOpacity = (isSequel || isPrequel)
      ? (theme === 'light' ? 0.95 : 0.85)
      : isAlternative
      ? (theme === 'light' ? 0.90 : 0.80)
      : isSpinOff
      ? (theme === 'light' ? 0.28 : 0.32)
      : (theme === 'light' ? 0.40 : 0.45);

    const edgeStrokeWidth = (isSequel || isPrequel) ? 2 : isAlternative ? 1.75 : 1.25;

    return {
      id: `e-${e.source}-${e.target}-${index}-${viewMode}-${orderMode}`,
      source: e.source.toString(),
      target: e.target.toString(),
      type: 'animeEdge',
      style: {
        stroke: strokeColor,
        strokeWidth: edgeStrokeWidth,
        strokeDasharray: isSpinOff ? '4,4' : undefined,
        opacity: edgeOpacity,
      },
      data: {
        label,
        isSequel: isSequel || isPrequel,
        isSpinOff,
        isAlternative,
        theme,
      },
    };
  });

  return { nodes, edges: formattedEdges };
}
