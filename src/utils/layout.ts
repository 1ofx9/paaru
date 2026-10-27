import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { AnimeNodeData, GraphFilterOptions, ViewMode } from '../types/anime';
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
  suiteMode: SuiteMode = 'anime'
): LayoutResult {
  let filteredMediaMap = new Map(mediaMap);
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

  const normalizedEdges: RawEdge[] = [];
  const edgeKeySet = new Set<string>();

  for (const edge of validEdges) {
    let source = edge.source;
    let target = edge.target;
    let type = edge.type;

    if (source === target) continue;

    const mediaA = filteredMediaMap.get(source);
    const mediaB = filteredMediaMap.get(target);
    if (!mediaA || !mediaB) continue;

    const yearA = typeof mediaA.seasonYear === 'number' ? mediaA.seasonYear : 9999;
    const yearB = typeof mediaB.seasonYear === 'number' ? mediaB.seasonYear : 9999;

    if (filters.orderMode === 'release') {
      if (yearA > yearB || (yearA === yearB && source > target)) {
        source = edge.target;
        target = edge.source;
        if (type === 'SEQUEL') {
          type = 'PREQUEL';
        } else if (type === 'PREQUEL') {
          type = 'SEQUEL';
        }
      }
    }

    const key = `${source}->${target}`;
    if (!edgeKeySet.has(key)) {
      edgeKeySet.add(key);
      normalizedEdges.push({ source, target, type });
    }
  }

  // Transitive reduction
  const adj = new Map<number, number[]>();
  for (const edge of normalizedEdges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }

  function hasAlternativePath(from: number, to: number): boolean {
    const visited = new Set<number>();
    const queue: number[] = [];

    const initialNeighbors = (adj.get(from) || []).filter((n) => n !== to);
    for (const n of initialNeighbors) {
      visited.add(n);
      queue.push(n);
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === to) return true;

      const nextNodes = adj.get(curr) || [];
      for (const next of nextNodes) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
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

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: viewMode === 'compact' ? 28 : 48,
    ranksep: viewMode === 'compact' ? 44 : 72,
    marginx: 32,
    marginy: 32,
  });

  filteredMediaMap.forEach((media) => {
    g.setNode(media.id.toString(), { width: nodeWidth, height: nodeHeight });
  });

  reducedEdges.forEach((edge, index) => {
    try {
      const isCanon = edge.type === 'SEQUEL' || edge.type === 'PREQUEL';
      const weight = isCanon ? 4 : 1;

      g.setEdge(
        edge.source.toString(),
        edge.target.toString(),
        { width: 25, height: 25, labelpos: 'c', weight, minlen: 1 },
        `e_${index}`
      );
    } catch (err) {
      console.warn('Dagre edge insertion warning:', err);
    }
  });

  if (filters.orderMode === 'release') {
    const yearGroups = new Map<number, number[]>();
    filteredMediaMap.forEach((media) => {
      const year = typeof media.seasonYear === 'number' ? media.seasonYear : 9999;
      if (!yearGroups.has(year)) yearGroups.set(year, []);
      yearGroups.get(year)!.push(media.id);
    });

    const sortedYears = Array.from(yearGroups.keys()).sort((a, b) => a - b);
    for (let i = 0; i < sortedYears.length - 1; i++) {
      const y1 = sortedYears[i];
      const y2 = sortedYears[i + 1];
      const nodeFrom = yearGroups.get(y1)?.[0];
      const nodeTo = yearGroups.get(y2)?.[0];
      if (nodeFrom && nodeTo && nodeFrom !== nodeTo) {
        g.setEdge(nodeFrom.toString(), nodeTo.toString(), { weight: 0, minlen: 1 }, `year_guide_${i}`);
      }
    }
  }

  try {
    dagre.layout(g);
  } catch (err) {
    console.warn('Dagre layout error fallback:', err);
  }

  const nodes: Node<AnimeNodeData>[] = Array.from(filteredMediaMap.values()).map((media, idx) => {
    const nodeMeta = g.node(media.id.toString());
    const x = nodeMeta && Number.isFinite(nodeMeta.x) ? nodeMeta.x - nodeWidth / 2 : idx * (nodeWidth + 48);
    const y = nodeMeta && Number.isFinite(nodeMeta.y) ? nodeMeta.y - nodeHeight / 2 : 40;

    return {
      id: media.id.toString(),
      type: 'animeNode',
      position: { x, y },
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
      : e.type.replace('_', ' ');

    const strokeColor = (isSequel || isPrequel)
      ? (theme === 'light' ? '#8b5cf6' : '#c4b5fd')
      : isSpinOff 
      ? (theme === 'light' ? '#059669' : '#a7f3d0')
      : isAlternative 
      ? (theme === 'light' ? '#ea580c' : '#fed7aa')
      : (theme === 'light' ? '#64748b' : '#94a3b8');

    const dagreEdge = g.edge(e.source.toString(), e.target.toString(), `e_${index}`);

    return {
      id: `e-${e.source}-${e.target}-${index}-${viewMode}`,
      source: e.source.toString(),
      target: e.target.toString(),
      type: 'animeEdge',
      animated: isSequel || isPrequel,
      style: {
        stroke: strokeColor,
        strokeWidth: (isSequel || isPrequel) ? 2 : 1.5,
        strokeDasharray: isSpinOff ? '4,4' : undefined,
        opacity: theme === 'light' ? 0.95 : 0.85,
      },
      data: {
        points: dagreEdge?.points,
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
