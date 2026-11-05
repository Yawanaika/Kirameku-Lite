"use client";

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const Game2048 = lazy(() => import("./toolbox/games/Game2048"));
const SnakeGame = lazy(() => import("./toolbox/games/SnakeGame"));
const MinesweeperGame = lazy(() => import("./toolbox/games/MinesweeperGame"));
const TetrisGame = lazy(() => import("./toolbox/games/TetrisGame"));
const FlappyBirdGame = lazy(() => import("./toolbox/games/FlappyBirdGame"));
const MemoryGame = lazy(() => import("./toolbox/games/MemoryGame"));
const GomokuGame = lazy(() => import("./toolbox/games/GomokuGame"));
const SudokuGame = lazy(() => import("./toolbox/games/SudokuGame"));

interface GameDef {
  id: string;
  name: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
}

const games: GameDef[] = [
  {
    id: "2048",
    name: "2048",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#f59e0b" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#f59e0b" strokeWidth="2" />
        <text x="24" y="30" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#f59e0b">2048</text>
      </svg>
    ),
    component: Game2048,
  },
  {
    id: "snake",
    name: "贪吃蛇",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#10b981" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#10b981" strokeWidth="2" />
        <path d="M14 28c0-2 2-4 4-4h4c2 0 4-2 4-4s2-4 4-4" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30" cy="16" r="2" fill="#10b981" />
        <circle cx="14" cy="28" r="3" fill="#10b981" />
      </svg>
    ),
    component: SnakeGame,
  },
  {
    id: "minesweeper",
    name: "扫雷",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#6366f1" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#6366f1" strokeWidth="2" />
        <circle cx="24" cy="24" r="8" stroke="#6366f1" strokeWidth="2" />
        <line x1="24" y1="12" x2="24" y2="16" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="32" x2="24" y2="36" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="24" x2="16" y2="24" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="24" x2="36" y2="24" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill="#6366f1" />
      </svg>
    ),
    component: MinesweeperGame,
  },
  {
    id: "tetris",
    name: "俄罗斯方块",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#06b6d4" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#06b6d4" strokeWidth="2" />
        <rect x="14" y="10" width="8" height="8" rx="1" fill="#06b6d4" opacity="0.6" />
        <rect x="22" y="10" width="8" height="8" rx="1" fill="#06b6d4" opacity="0.6" />
        <rect x="22" y="18" width="8" height="8" rx="1" fill="#06b6d4" opacity="0.6" />
        <rect x="22" y="26" width="8" height="8" rx="1" fill="#06b6d4" opacity="0.6" />
        <rect x="14" y="30" width="8" height="8" rx="1" fill="#06b6d4" opacity="0.6" />
      </svg>
    ),
    component: TetrisGame,
  },
  {
    id: "flappy",
    name: "像素鸟",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#f59e0b" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#f59e0b" strokeWidth="2" />
        <circle cx="22" cy="22" r="6" fill="#f59e0b" />
        <circle cx="25" cy="20" r="2" fill="white" />
        <circle cx="25.5" cy="20" r="1" fill="#333" />
        <path d="M28 22l6-2v4l-6-2z" fill="#e8772a" />
      </svg>
    ),
    component: FlappyBirdGame,
  },
  {
    id: "memory",
    name: "记忆翻牌",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#ec4899" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#ec4899" strokeWidth="2" />
        <rect x="12" y="14" width="10" height="14" rx="2" fill="#ec4899" opacity="0.4" />
        <rect x="26" y="14" width="10" height="14" rx="2" stroke="#ec4899" strokeWidth="1.5" />
        <path d="M29 21l2 2 4-4" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    component: MemoryGame,
  },
  {
    id: "gomoku",
    name: "五子棋",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#f59e0b" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#f59e0b" strokeWidth="2" />
        <line x1="14" y1="14" x2="14" y2="34" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <line x1="24" y1="14" x2="24" y2="34" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <line x1="34" y1="14" x2="34" y2="34" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <line x1="14" y1="14" x2="34" y2="14" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <line x1="14" y1="24" x2="34" y2="24" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <line x1="14" y1="34" x2="34" y2="34" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <circle cx="14" cy="24" r="4" fill="#1e293b" />
        <circle cx="24" cy="14" r="4" fill="white" stroke="#94a3b8" strokeWidth="1" />
        <circle cx="34" cy="34" r="4" fill="#1e293b" />
      </svg>
    ),
    component: GomokuGame,
  },
  {
    id: "sudoku",
    name: "数独",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#6366f1" opacity="0.15" />
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="#6366f1" strokeWidth="2" />
        <line x1="18" y1="10" x2="18" y2="38" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
        <line x1="30" y1="10" x2="30" y2="38" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="18" x2="38" y2="18" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
        <line x1="10" y1="30" x2="38" y2="30" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
        <text x="14" y="17" fontSize="7" fill="#6366f1">5</text>
        <text x="25" y="27" fontSize="7" fill="#6366f1">9</text>
        <text x="34" y="17" fontSize="7" fill="#6366f1">1</text>
        <text x="14" y="37" fontSize="7" fill="#6366f1">3</text>
      </svg>
    ),
    component: SudokuGame,
  },
];

const STORAGE_KEY = "games-panel-order";

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const ids = JSON.parse(saved);
      if (Array.isArray(ids)) {
        const allIds = games.map((g) => g.id);
        const valid = ids.filter((id: string) => allIds.includes(id));
        const missing = allIds.filter((id) => !valid.includes(id));
        return [...valid, ...missing];
      }
    }
  } catch { }
  return games.map((g) => g.id);
}

function SortableGameIcon({
  game,
  onClick,
}: {
  game: GameDef;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: game.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-2 p-4 md:p-5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 w-full"
      >
        {game.icon}
        <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">{game.name}</span>
      </button>
    </div>
  );
}

type ResizeDir = "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

function ResizeHandle({ dir, onResize }: { dir: ResizeDir; onResize: (dw: number, dh: number) => void }) {
  const prevPos = useRef({ x: 0, y: 0 });

  const cursorMap: Record<ResizeDir, string> = {
    top: "cursor-ns-resize", bottom: "cursor-ns-resize",
    left: "cursor-ew-resize", right: "cursor-ew-resize",
    "top-left": "cursor-nwse-resize", "bottom-right": "cursor-nwse-resize",
    "top-right": "cursor-nesw-resize", "bottom-left": "cursor-nesw-resize",
  };

  const posMap: Record<ResizeDir, string> = {
    top: "top-0 left-2 right-2 h-2",
    bottom: "bottom-2 left-2 right-2 h-2",
    left: "top-2 bottom-2 left-0 w-2",
    right: "top-2 bottom-2 right-0 w-2",
    "top-left": "top-0 left-0 w-5 h-5",
    "top-right": "top-0 right-0 w-5 h-5",
    "bottom-left": "bottom-2 left-0 w-5 h-5",
    "bottom-right": "bottom-2 right-0 w-5 h-5",
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={false}
      dragSnapToOrigin
      onDragStart={(_e, info) => { prevPos.current = { x: info.point.x, y: info.point.y }; }}
      onDrag={(_e, info) => {
        const dx = info.point.x - prevPos.current.x;
        const dy = info.point.y - prevPos.current.y;
        prevPos.current = { x: info.point.x, y: info.point.y };
        let dw = 0, dh = 0;
        if (dir.includes("right")) dw = dx;
        if (dir.includes("left")) dw = -dx;
        if (dir.includes("bottom")) dh = dy;
        if (dir.includes("top")) dh = -dy;
        onResize(dw, dh);
      }}
      className={`absolute z-50 ${posMap[dir]} ${cursorMap[dir]}`}
    />
  );
}

export default function GamesPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [gameOrder, setGameOrder] = useState<string[]>(() => loadOrder());
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const panelDidDrag = useRef(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 });
  const [panelW, setPanelW] = useState(640);
  const [panelH, setPanelH] = useState(480);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGameOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
        return newOrder;
      });
    }
  }, []);

  const orderedGames = gameOrder
    .map((id) => games.find((g) => g.id === id))
    .filter(Boolean) as GameDef[];

  useEffect(() => {
    const open = () => {
      setIsOpen(true);
      setActiveGame(null);
      setOffset({ x: 0, y: 0 });
      setResizeOffset({ x: 0, y: 0 });
      setPanelW(isMobile ? window.innerWidth - 32 : 1040);
      setPanelH(isMobile ? window.innerHeight - 120 : 860);
    };
    window.addEventListener("open-games-panel", open);
    return () => window.removeEventListener("open-games-panel", open);
  }, [isMobile]);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveGame(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  const currentGame = games.find((g) => g.id === activeGame);

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", top: 80, left: 16, right: 16, bottom: 40 }
    : {
      position: "fixed",
      top: 80 + resizeOffset.y,
      left: `calc(50% - ${panelW / 2}px + ${resizeOffset.x}px)`,
      width: panelW,
      height: panelH,
    };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          drag={!isMobile}
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={false}
          onDragStart={() => { panelDidDrag.current = true; }}
          onDragEnd={(_e, info) => {
            setTimeout(() => { panelDidDrag.current = false; }, 100);
            setOffset((prev) => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }));
          }}
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ ...panelStyle, zIndex: 40, x: isMobile ? 0 : offset.x, y: isMobile ? 0 : offset.y }}
          className="rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
        >
          {/* 顶部栏 — 拖拽把手 */}
          <div
            onPointerDown={isMobile ? undefined : (e) => dragControls.start(e)}
            className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              {activeGame && (
                <button
                  type="button"
                  onClick={() => setActiveGame(null)}
                  title="返回"
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {activeGame ? currentGame?.name : "小游戏"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setIsOpen(false); setActiveGame(null); }}
              title="关闭"
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-auto overscroll-contain p-4 flex flex-col">
            {activeGame && currentGame ? (
              <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-slate-400 animate-pulse">加载中...</div>}>
                {isMobile ? (
                  <div className="flex items-center justify-center h-full">
                    <currentGame.component />
                  </div>
                ) : (
                  <currentGame.component />
                )}
              </Suspense>
            ) : (
              <div className="flex items-start justify-center">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={orderedGames.map((g) => g.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-3 gap-4 md:gap-6">
                      {orderedGames.map((game) => (
                        <SortableGameIcon
                          key={game.id}
                          game={game}
                          onClick={() => setActiveGame(game.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>

          {/* 底部指示条 */}
          <div className="flex justify-center py-1.5 shrink-0">
            <div className="w-16 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* 缩放把手 */}
          {!isMobile && (
            <>
              <ResizeHandle dir="bottom-right" onResize={(dw, dh) => {
                setPanelW((w) => Math.min(Math.max(w + dw, 500), 1400));
                setPanelH((h) => Math.min(Math.max(h + dh, 400), 1200));
              }} />
              <ResizeHandle dir="top-left" onResize={(dw, dh) => {
                const newW = Math.min(Math.max(panelW + dw, 500), 1200);
                const newH = Math.min(Math.max(panelH + dh, 400), 1200);
                const actualDw = newW - panelW;
                const actualDh = newH - panelH;
                setPanelW(newW);
                setPanelH(newH);
                setResizeOffset((p) => ({ x: p.x - actualDw, y: p.y - actualDh }));
              }} />
              <ResizeHandle dir="top-right" onResize={(_dw, dh) => {
                const newH = Math.min(Math.max(panelH + dh, 400), 1200);
                const actualDh = newH - panelH;
                setPanelH(newH);
                setResizeOffset((p) => ({ x: p.x, y: p.y - actualDh }));
              }} />
              <ResizeHandle dir="bottom-left" onResize={(dw, _dh) => {
                const newW = Math.min(Math.max(panelW + dw, 500), 1200);
                const actualDw = newW - panelW;
                setPanelW(newW);
                setResizeOffset((p) => ({ x: p.x - actualDw, y: p.y }));
              }} />
            </>
          )}

          {/* 缩放角标 */}
          {!isMobile && (
            <div className="absolute bottom-1 right-1 pointer-events-none opacity-30">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M12 2L2 12M12 7L7 12M12 12L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-400 dark:text-slate-500" />
              </svg>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
