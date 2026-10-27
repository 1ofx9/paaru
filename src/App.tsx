import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  PanOnScrollMode,
} from '@xyflow/react';
import type { NodeMouseHandler, Node, Edge } from '@xyflow/react';
import { AnimeNode } from './components/AnimeNode';
import { AnimeEdge } from './components/AnimeEdge';
import { FloatingNav } from './components/FloatingNav';
import { CanvasControls } from './components/CanvasControls';
import { useTimeline } from './hooks/useTimeline';
import { useAniListUser } from './hooks/useAniListUser';
import { useTheme } from './hooks/useTheme';
import type { AnimeNodeData, GraphFilterOptions, ViewMode } from './types/anime';
import type { SuiteMode } from './types/media';
import { AlertCircle } from 'lucide-react';

const DetailSheet = lazy(() => import('./components/DetailSheet').then((m) => ({ default: m.DetailSheet })));
const LegendModal = lazy(() => import('./components/LegendModal').then((m) => ({ default: m.LegendModal })));
import GradientASCII from './components/GradientASCII';

const nodeTypes = {
  animeNode: AnimeNode,
};

const edgeTypes = {
  animeEdge: AnimeEdge,
};

interface CanvasViewProps {
  nodes: Node<AnimeNodeData>[];
  edges: Edge[];
  theme: 'dark' | 'light';
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  isLoading: boolean;
  selectedMediaId: number | null;
  targetFocusNodeId?: number | null;
  onSelectNode: (id: number) => void;
  onResetToEmpty: () => void;
  hasActiveAnime: boolean;
  suiteMode: SuiteMode;
}

function CanvasView({
  nodes,
  edges,
  theme,
  viewMode,
  onToggleViewMode,
  isLoading,
  selectedMediaId,
  targetFocusNodeId,
  onSelectNode,
  onResetToEmpty,
  hasActiveAnime,
  suiteMode,
}: CanvasViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const { fitView, setCenter } = useReactFlow();

  const nodeOffsetX = viewMode === 'compact' ? 40 : 130;
  const nodeOffsetY = viewMode === 'compact' ? 60 : 43;

  useEffect(() => {
    if (!targetFocusNodeId) return;
    const targetNode = nodes.find((n) => n.id === targetFocusNodeId.toString());
    if (targetNode) {
      setCenter(targetNode.position.x + nodeOffsetX, targetNode.position.y + nodeOffsetY, {
        zoom: 1.05,
        duration: 500,
      });
    }
  }, [targetFocusNodeId, nodes, setCenter, nodeOffsetX, nodeOffsetY]);

  const hasFittedInitialRef = useRef(false);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (nodes.length === 0) return;

    const shouldFitInitial = !hasFittedInitialRef.current;
    const shouldFitComplete = wasLoadingRef.current && !isLoading;

    if (shouldFitInitial || shouldFitComplete) {
      if (shouldFitInitial) {
        hasFittedInitialRef.current = true;
      }

      const nextNode = nodes.find((n) => n.data.isNextUp);

      const timer = setTimeout(() => {
        if (shouldFitComplete && nextNode) {
          setCenter(nextNode.position.x + nodeOffsetX, nextNode.position.y + nodeOffsetY, {
            zoom: 0.95,
            duration: 600,
          });
        } else if (shouldFitInitial && nextNode) {
          const isMobile = window.innerWidth < 640;
          setCenter(nextNode.position.x + nodeOffsetX, nextNode.position.y + nodeOffsetY, {
            zoom: isMobile ? 0.75 : 0.95,
            duration: 400,
          });
        } else {
          fitView({
            padding: window.innerWidth < 640 ? 0.2 : 0.12,
            minZoom: 0.5,
            maxZoom: 1.0,
            duration: shouldFitComplete ? 500 : 400,
          });
        }
      }, 80);
      return () => clearTimeout(timer);
    }

    wasLoadingRef.current = isLoading;
  }, [nodes, isLoading, fitView, setCenter, nodeOffsetX, nodeOffsetY]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      onSelectNode(parseInt(node.id, 10));
    },
    [onSelectNode]
  );

  const handleCenterNextUp = useCallback(() => {
    const nextNode = nodes.find((n) => n.data.isNextUp);
    if (nextNode) {
      setCenter(nextNode.position.x + nodeOffsetX, nextNode.position.y + nodeOffsetY, {
        zoom: 0.95,
        duration: 500,
      });
    }
  }, [nodes, setCenter, nodeOffsetX, nodeOffsetY]);

  const hasNextUp = useMemo(() => {
    return suiteMode === 'anime' && nodes.some((n) => n.data.isNextUp);
  }, [nodes, suiteMode]);

  const activeFocusId = hoveredNodeId ?? selectedMediaId;

  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    if (!activeFocusId) {
      return { highlightedNodeIds: null, highlightedEdgeIds: null };
    }

    const targetStr = activeFocusId.toString();
    const nodeIds = new Set<string>([targetStr]);
    const edgeIds = new Set<string>();

    for (const edge of edges) {
      if (edge.target === targetStr && !edge.data?.isSequel) {
        nodeIds.add(edge.source);
        edgeIds.add(edge.id);
      }
      if (edge.source === targetStr && !edge.data?.isSequel) {
        nodeIds.add(edge.target);
        edgeIds.add(edge.id);
      }
    }

    const spineSeeds = Array.from(nodeIds);
    for (const seed of spineSeeds) {
      let currBack = seed;
      while (true) {
        const inEdge = edges.find((e) => e.target === currBack && e.data?.isSequel);
        if (inEdge && !nodeIds.has(inEdge.source)) {
          nodeIds.add(inEdge.source);
          edgeIds.add(inEdge.id);
          currBack = inEdge.source;
        } else {
          break;
        }
      }

      let currFwd = seed;
      while (true) {
        const outEdge = edges.find((e) => e.source === currFwd && e.data?.isSequel);
        if (outEdge && !nodeIds.has(outEdge.target)) {
          nodeIds.add(outEdge.target);
          edgeIds.add(outEdge.id);
          currFwd = outEdge.target;
        } else {
          break;
        }
      }
    }

    return { highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds };
  }, [activeFocusId, edges]);

  const displayNodes = useMemo(() => {
    if (!highlightedNodeIds && hoveredNodeId === null) return nodes;
    return nodes.map((node) => {
      const isDirectHover = hoveredNodeId === parseInt(node.id, 10);
      const isInPath = highlightedNodeIds ? highlightedNodeIds.has(node.id) : false;
      const isDimmed = highlightedNodeIds ? !highlightedNodeIds.has(node.id) : false;

      return {
        ...node,
        data: {
          ...node.data,
          isDirectHover,
          isInPath,
          isDimmed,
        },
      };
    });
  }, [nodes, highlightedNodeIds, hoveredNodeId]);

  const displayEdges = useMemo(() => {
    if (!highlightedEdgeIds) return edges;
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        isHighlighted: highlightedEdgeIds.has(edge.id),
        isDimmed: !highlightedEdgeIds.has(edge.id),
      },
    }));
  }, [edges, highlightedEdgeIds]);

  return (
    <>
      <div
        className={`w-full h-full canvas-bg-dots transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hasActiveAnime ? 'pointer-events-auto opacity-100 visible' : 'pointer-events-none opacity-0 invisible'
        }`}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <ReactFlow
          style={{ backgroundColor: 'transparent' }}
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(parseInt(node.id, 10))}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onPaneClick={() => {
            onSelectNode(0);
            setHoveredNodeId(null);
          }}
          fitView
          fitViewOptions={{
            padding: 0.12,
            minZoom: 0.65,
            maxZoom: 1.25,
          }}
          minZoom={0.25}
          maxZoom={2.0}
          panOnScroll={hasActiveAnime}
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnPinch={hasActiveAnime}
          zoomOnScroll={hasActiveAnime}
          panOnDrag={hasActiveAnime}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={hasActiveAnime}
          defaultEdgeOptions={{
            type: 'animeEdge',
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color={theme === 'dark' ? "rgba(255, 255, 255, 0.20)" : "rgba(0, 0, 0, 0.30)"}
          />
        </ReactFlow>
      </div>

      {hasActiveAnime && (
        <CanvasControls
          onCenterNextUp={handleCenterNextUp}
          hasNextUp={hasNextUp}
          onResetToEmpty={onResetToEmpty}
          viewMode={viewMode}
          onToggleViewMode={onToggleViewMode}
          suiteMode={suiteMode}
        />
      )}
    </>
  );
}

function getViewModeKey(mode: SuiteMode): string {
  return `paaru_view_mode_${mode}`;
}

function getInitialViewMode(mode: SuiteMode): ViewMode {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  if (viewParam === 'compact' || viewParam === 'detailed') {
    return viewParam;
  }
  try {
    const saved = localStorage.getItem(getViewModeKey(mode));
    if (saved === 'compact' || saved === 'detailed') {
      return saved as ViewMode;
    }
  } catch {}
  return mode === 'anime' ? 'detailed' : 'compact';
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [filters, setFilters] = useState<GraphFilterOptions>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      mainStoryOnly: params.get('main') === '1',
      hideSpinOffs: params.get('spinoffs') === '0',
      unwatchedOnly: params.get('unwatched') === '1',
      hideSpecials: params.get('specials') === '0',
      releasedOnly: params.get('released') === '1',
      orderMode: params.get('order') === 'chronological' ? 'chronological' : 'release',
    };
  });

  const [suiteMode, setSuiteMode] = useState<SuiteMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'movies' || mode === 'shows' || mode === 'anime') {
      return mode;
    }
    return 'anime';
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return getInitialViewMode(suiteMode);
  });

  const [isLegendOpen, setIsLegendOpen] = useState(false);

  const {
    userName,
    user,
    userEntries,
    isLoadingUser,
    userError,
    setUserName,
    refreshUser,
    logout,
    clearUserError,
  } = useAniListUser();

  const {
    rootMediaId,
    isLoading,
    progress,
    error,
    nodes,
    edges,
    timelineStats,
    selectedMediaId,
    selectedMedia,
    loadTimeline,
    clearTimeline,
    setSelectedMediaId,
  } = useTimeline(userEntries, filters, viewMode, theme, suiteMode);

  const [targetFocusNodeId, setTargetFocusNodeId] = useState<number | null>(null);

  const handleFocusNode = useCallback((id: number) => {
    setSelectedMediaId(id);
    setTargetFocusNodeId(id);
    const timer = setTimeout(() => setTargetFocusNodeId(null), 600);
    return () => clearTimeout(timer);
  }, [setSelectedMediaId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (rootMediaId) {
      url.searchParams.set('id', rootMediaId.toString());
    } else {
      url.searchParams.delete('id');
    }

    if (filters.mainStoryOnly) url.searchParams.set('main', '1');
    else url.searchParams.delete('main');

    if (filters.hideSpinOffs) url.searchParams.set('spinoffs', '0');
    else url.searchParams.delete('spinoffs');

    if (filters.hideSpecials) url.searchParams.set('specials', '0');
    else url.searchParams.delete('specials');

    if (filters.releasedOnly) url.searchParams.set('released', '1');
    else url.searchParams.delete('released');

    if (filters.unwatchedOnly) url.searchParams.set('unwatched', '1');
    else url.searchParams.delete('unwatched');

    if (filters.orderMode === 'chronological') url.searchParams.set('order', 'chronological');
    else url.searchParams.delete('order');

    const defaultView = suiteMode === 'anime' ? 'detailed' : 'compact';
    if (viewMode !== defaultView) url.searchParams.set('view', viewMode);
    else url.searchParams.delete('view');

    if (suiteMode !== 'anime') url.searchParams.set('mode', suiteMode);
    else url.searchParams.delete('mode');

    window.history.replaceState({}, '', url.toString());
  }, [rootMediaId, filters, viewMode, suiteMode]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f6f7f9] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 select-none transition-colors duration-200">
      <div
        className={`fixed inset-0 pointer-events-none overflow-hidden transition-all duration-500 ease-out ${
          rootMediaId
            ? 'opacity-0 -translate-y-16 pointer-events-none'
            : 'opacity-100 translate-y-0'
        }`}
        style={{ zIndex: 0 }}
      >
        <GradientASCII
          colors={['#09090b', '#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#e4e4e7', '#ffffff']}
          lightMode={theme === 'light'}
          speed={0.35}
          glyphOpacity={0.85}
          gradientOpacity={0.9}
          glow={theme === 'dark' ? 0.22 : 0.15}
          cellSize={18}
          depthOfField={0.15}
          shape="horizon"
          intro={true}
          paused={Boolean(rootMediaId)}
          mouseInteraction={!rootMediaId}
          scrambleRadius={0.12}
          clickEffect="wave"
        />
      </div>

      <FloatingNav
        user={user}
        userName={userName}
        isLoadingUser={isLoadingUser}
        userError={userError}
        onClearUserError={clearUserError}
        onSyncUser={setUserName}
        onRefreshUser={refreshUser}
        onLogoutUser={logout}
        filters={filters}
        onUpdateFilters={(newFilters) =>
          setFilters((prev) => ({ ...prev, ...newFilters }))
        }
        onOpenLegend={() => setIsLegendOpen(true)}
        hasActiveAnime={Boolean(rootMediaId)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectTimeline={(id, mode) => loadTimeline(id, mode || suiteMode)}
        onClearTimeline={clearTimeline}
        nodes={nodes}
        userEntries={userEntries}
        onFocusNode={handleFocusNode}
        suiteMode={suiteMode}
        onSelectSuiteMode={(newMode) => {
          if (newMode !== suiteMode) {
            clearTimeline();
            setSuiteMode(newMode);
            setViewMode(getInitialViewMode(newMode));
            const url = new URL(window.location.href);
            url.searchParams.delete('id');
            url.searchParams.set('mode', newMode);
            window.history.replaceState({}, '', url.toString());
          }
        }}
        timelineStats={timelineStats}
        isLoading={isLoading}
        progress={progress}
      />

      {error && (
        <div className="fixed top-28 sm:top-32 inset-x-0 mx-auto w-fit max-w-md z-30 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-300 text-xs shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          <span className="truncate">{error}</span>
          {rootMediaId && (
            <button
              onClick={() => loadTimeline(rootMediaId)}
              className="ml-2 px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium text-[10px] hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          )}
          <button
            onClick={clearTimeline}
            className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-[10px] hover:text-black dark:hover:text-white transition-colors cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <ReactFlowProvider key={`${rootMediaId ?? 'home'}-${viewMode}-${filters.orderMode}`}>
        <CanvasView
          nodes={nodes}
          edges={edges}
          theme={theme}
          viewMode={viewMode}
          onToggleViewMode={() =>
            setViewMode((v) => {
              const next = v === 'compact' ? 'detailed' : 'compact';
              try {
                localStorage.setItem(getViewModeKey(suiteMode), next);
              } catch {}
              return next;
            })
          }
          isLoading={isLoading}
          selectedMediaId={selectedMediaId}
          targetFocusNodeId={targetFocusNodeId}
          onSelectNode={(id) => setSelectedMediaId(id || null)}
          onResetToEmpty={clearTimeline}
          hasActiveAnime={Boolean(rootMediaId)}
          suiteMode={suiteMode}
        />
      </ReactFlowProvider>

      <Suspense fallback={null}>
        <DetailSheet
          media={selectedMedia}
          onClose={() => setSelectedMediaId(null)}
          suiteMode={suiteMode}
        />
        <LegendModal
          isOpen={isLegendOpen}
          onClose={() => setIsLegendOpen(false)}
          suiteMode={suiteMode}
        />
      </Suspense>
    </div>
  );
}
