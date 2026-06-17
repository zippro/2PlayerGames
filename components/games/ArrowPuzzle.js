'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { LEVELS, canArrowEscape, getEscapeDir, getArrowCells, solve, getLegalMoves, getBlockerDistance } from '@/lib/arrowLevels';

// ─── Constants ───
const PROGRESS_KEY = 'arrow-escape-progress';
const HEARTS_KEY = 'arrow-escape-hearts';
const MAX_HEARTS = 3;
const HEART_REGEN_MS = 20 * 60 * 1000; // 20 minutes
const STARTING_HINTS = 3;
const ARROW_COLOR = '#1a1a2e';
const ARROW_BLOCKED = '#E74C3C';
const ARROW_HINT = '#FFD700';
const BG_COLOR = '#F4F1FA';

// ─── Animation timing constants ───
const EXTRACT_DURATION_MS = 1200;
const INTRO_DURATION_MS = 1000;
const BLOCKED_FLY_MS = 150;
const BLOCKED_PAUSE_MS = 60;
const BLOCKED_RETRACT_MS = 120;
const SHAKE_DURATION_MS = 600;
const HINT_DURATION_MS = 2500;
const CLUE_IDLE_MS = 4000;
const SNAKE_HEAD_SPEED = 1.3;  // head leads by 30%
const SNAKE_TAIL_SPEED = 0.7;  // tail lags by 30%
const GAP = 0.2;               // cell gap at arrow ends
const BLOCKER_GAP = 0.3;       // gap before blocker in blocked animation
const IGNIS_SPAWN_RATE = 1;     // particles per frame (soft)
const IGNIS_LIFETIME_MS = 500;  // particle lifetime
const IGNIS_COLORS = ['#FFB347', '#FFCC80', '#FFE0B2', '#FFA726', '#FFD54F'];

// ─── Persistence ───
function loadProgress() {
  try {
    const d = localStorage.getItem(PROGRESS_KEY);
    return d ? JSON.parse(d) : { completed: {}, unlocked: 1, hints: STARTING_HINTS };
  } catch { return { completed: {}, unlocked: 1, hints: STARTING_HINTS }; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
}
function loadHearts() {
  try {
    const d = localStorage.getItem(HEARTS_KEY);
    if (d) {
      const h = JSON.parse(d);
      const now = Date.now();
      const elapsed = now - (h.lastUpdate || now);
      const regenCount = Math.floor(elapsed / HEART_REGEN_MS);
      const newHearts = Math.min(MAX_HEARTS, h.count + regenCount);
      return { count: newHearts, lastUpdate: newHearts >= MAX_HEARTS ? now : h.lastUpdate + regenCount * HEART_REGEN_MS };
    }
  } catch {}
  return { count: MAX_HEARTS, lastUpdate: Date.now() };
}
function saveHearts(h) {
  try { localStorage.setItem(HEARTS_KEY, JSON.stringify(h)); } catch {}
}

// ─── Build SVG path for arrow body ───
// Points are in grid coordinates; maps to grid DOT positions (x*cs, y*cs)
function buildArrowPath(points, cs, radius) {
  if (points.length < 2) return '';
  const r = Math.min(radius, cs * 0.3);
  const px = points.map(([x, y]) => [x * cs, y * cs]);

  if (px.length === 2) {
    return `M ${px[0][0]} ${px[0][1]} L ${px[1][0]} ${px[1][1]}`;
  }

  let d = `M ${px[0][0]} ${px[0][1]}`;
  for (let i = 1; i < px.length - 1; i++) {
    const prev = px[i - 1], curr = px[i], next = px[i + 1];
    const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const rr = Math.min(r, len1 / 2, len2 / 2);
    const bx = curr[0] - (dx1 / len1) * rr;
    const by = curr[1] - (dy1 / len1) * rr;
    const ax = curr[0] + (dx2 / len2) * rr;
    const ay = curr[1] + (dy2 / len2) * rr;
    d += ` L ${bx} ${by} Q ${curr[0]} ${curr[1]} ${ax} ${ay}`;
  }
  d += ` L ${px[px.length - 1][0]} ${px[px.length - 1][1]}`;
  return d;
}

// ─── Path geometry helpers for snake animation ───
function polylineLength(pts) {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function slicePolyline(pts, startDist, endDist) {
  if (startDist >= endDist) return [];
  const result = [];
  let cumDist = 0;
  let started = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen === 0) continue;
    const segEnd = cumDist + segLen;
    if (!started && segEnd > startDist) {
      const t = Math.max(0, (startDist - cumDist) / segLen);
      result.push([pts[i][0] + dx * t, pts[i][1] + dy * t]);
      started = true;
    }
    if (started) {
      if (segEnd >= endDist) {
        const t = Math.min(1, (endDist - cumDist) / segLen);
        result.push([pts[i][0] + dx * t, pts[i][1] + dy * t]);
        break;
      } else {
        result.push([...pts[i + 1]]);
      }
    }
    cumDist = segEnd;
  }
  return result;
}

// ─── Shared helpers ───
function deepCopyArrows(arr) {
  return arr.map(a => ({ ...a, points: a.points.map(p => [...p]) }));
}

// Inset tail point for clean gap at arrow start
function insetTail(vPts) {
  if (vPts.length < 2) return;
  const dx = vPts[1][0] - vPts[0][0];
  const dy = vPts[1][1] - vPts[0][1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0.01) {
    const inset = Math.min(0.15, len * 0.3);
    vPts[0] = [vPts[0][0] + (dx / len) * inset, vPts[0][1] + (dy / len) * inset];
  }
}

// Inset tip so stroke path ends at arrowhead base, not tip
function insetTipForArrowhead(vPts, cs) {
  const ti = vPts.length - 1;
  if (ti < 1) return;
  const dx = vPts[ti][0] - vPts[ti - 1][0];
  const dy = vPts[ti][1] - vPts[ti - 1][1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0.01) {
    const headInset = Math.max(9, cs * 0.25) / cs;
    vPts[ti] = [vPts[ti][0] - (dx / len) * headInset, vPts[ti][1] - (dy / len) * headInset];
  }
}

// Compute arrowhead polygon points
function computeArrowhead(vPts, cs) {
  const tip = vPts[vPts.length - 1];
  const prev = vPts[vPts.length - 2];
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const ndx = len > 0 ? dx / len : 0;
  const ndy = len > 0 ? dy / len : 0;
  const tipX = tip[0] * cs;
  const tipY = tip[1] * cs;
  const hL = Math.max(9, cs * 0.25);
  const hW = Math.max(6, cs * 0.17);
  return {
    tipX, tipY, ndx, ndy, hL, hW,
    points: `${tipX},${tipY} ${tipX - ndx * hL + ndy * hW},${tipY - ndy * hL - ndx * hW} ${tipX - ndx * hL - ndy * hW},${tipY - ndy * hL + ndx * hW}`,
  };
}

// ─── Hearts display ───
function HeartsHUD({ hearts, maxHearts, regenTimeLeft }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: maxHearts }, (_, i) => (
        <span key={i} style={{
          fontSize: 16,
          filter: i < hearts ? 'none' : 'grayscale(1) opacity(0.25)',
          transition: 'all 0.3s ease',
          transform: i < hearts ? 'scale(1)' : 'scale(0.8)',
        }}>❤️</span>
      ))}
      {hearts < maxHearts && regenTimeLeft > 0 && (
        <span style={{ fontSize: 9, color: '#999', fontFamily: 'var(--font-display)', marginLeft: 3 }}>
          {Math.floor(regenTimeLeft / 60)}:{String(regenTimeLeft % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function ArrowPuzzle({ mode, difficulty, onGameEnd }) {
  const [phase, setPhase] = useState('levelSelect');
  const [progress, setProgress] = useState(loadProgress);
  const [heartsData, setHeartsData] = useState(loadHearts);
  const [currentLevelId, setCurrentLevelId] = useState(null);
  const [arrows, setArrows] = useState([]);
  const [flyingId, setFlyingId] = useState(null);
  const [shakeArrow, setShakeArrow] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [heartsLost, setHeartsLost] = useState(0);
  const [undoState, setUndoState] = useState(null);
  const [undoUsed, setUndoUsed] = useState(false);
  const [hintArrowId, setHintArrowId] = useState(null);
  const [regenSeconds, setRegenSeconds] = useState(0);
  const [levelComplete, setLevelComplete] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0); // 0–1 snake anim
  const [introProgress, setIntroProgress] = useState(1); // 0→1 entrance anim
  const [blockedFlyId, setBlockedFlyId] = useState(null);
  const [blockedFlyProgress, setBlockedFlyProgress] = useState(0); // 0→1→2 (out then back)
  const [blockedFlyData, setBlockedFlyData] = useState(null); // { escDir, blockerDist }
  const [blockedRedIds, setBlockedRedIds] = useState(new Set()); // arrows that stay red after crash
  const [showClueTicker, setShowClueTicker] = useState(false);
  const lastMoveTimeRef = useRef(Date.now());
  const containerRef = useRef(null);
  const boardWrapRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 350, h: 500 });
  const levelStartTime = useRef(Date.now());
  const extractRafRef = useRef(null);
  const introRafRef = useRef(null);
  const blockedRafRef = useRef(null);
  const shakeTimeoutRef = useRef(null);
  const clueTimeoutRef = useRef(null);
  const smokeParticlesRef = useRef([]); // [{x, y, vx, vy, born, size, color, type}]
  const cellSizeRef = useRef(40);
  const arrowsRef = useRef([]);

  // ── Cleanup RAFs and timeouts on unmount ──
  useEffect(() => {
    return () => {
      if (extractRafRef.current) cancelAnimationFrame(extractRafRef.current);
      if (introRafRef.current) cancelAnimationFrame(introRafRef.current);
      if (blockedRafRef.current) cancelAnimationFrame(blockedRafRef.current);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (clueTimeoutRef.current) clearTimeout(clueTimeoutRef.current);
    };
  }, []);

  // ── Idle clue ticker: show after CLUE_IDLE_MS of no moves ──
  useEffect(() => {
    if (phase !== 'playing' || levelComplete || arrows.length === 0 || showClueTicker || hintArrowId || flyingId || blockedFlyId) return;
    clueTimeoutRef.current = setTimeout(() => {
      setShowClueTicker(true);
    }, CLUE_IDLE_MS);
    return () => { if (clueTimeoutRef.current) clearTimeout(clueTimeoutRef.current); };
  }, [phase, levelComplete, arrows.length, showClueTicker, hintArrowId, flyingId, blockedFlyId]);

  // ── Zoom state ──
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;

  const currentLevel = currentLevelId ? LEVELS.find(l => l.id === currentLevelId) : null;


  // Heart regen timer
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartsData(prev => {
        if (prev.count >= MAX_HEARTS) return prev;
        const now = Date.now();
        const elapsed = now - prev.lastUpdate;
        if (elapsed >= HEART_REGEN_MS) {
          const regen = Math.floor(elapsed / HEART_REGEN_MS);
          const newCount = Math.min(MAX_HEARTS, prev.count + regen);
          const nd = { count: newCount, lastUpdate: newCount >= MAX_HEARTS ? now : prev.lastUpdate + regen * HEART_REGEN_MS };
          saveHearts(nd);
          return nd;
        }
        setRegenSeconds(Math.ceil((HEART_REGEN_MS - elapsed) / 1000));
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Resize observer
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: r.width, h: r.height });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [phase]);

  // Cell size
  const cellSize = useMemo(() => {
    if (!currentLevel) return 40;
    const padding = 28;
    const availW = containerSize.w - padding * 2;
    const availH = containerSize.h - 190;
    return Math.min(
      Math.floor(availW / currentLevel.gridW),
      Math.floor(availH / currentLevel.gridH),
      52
    );
  }, [currentLevel, containerSize]);
  cellSizeRef.current = cellSize;
  arrowsRef.current = arrows;

  // Occupied grid dots — computed from INITIAL level arrows (persists after removal)
  const occupiedDots = useMemo(() => {
    if (!currentLevel) return new Set();
    const dots = new Set();
    for (const arrow of currentLevel.arrows) {
      const cells = getArrowCells(arrow);
      for (const c of cells) dots.add(c);
    }
    return dots;
  }, [currentLevel]);

  // Which arrows can escape
  const escapableIds = useMemo(() => {
    if (!currentLevel) return new Set();
    const ids = new Set();
    for (const arrow of arrows) {
      if (canArrowEscape(arrow, arrows, currentLevel.gridW, currentLevel.gridH)) {
        ids.add(arrow.id);
      }
    }
    return ids;
  }, [arrows, currentLevel]);

  // Load level
  const loadLevel = useCallback((id) => {
    const level = LEVELS.find(l => l.id === id);
    if (!level) return;
    setCurrentLevelId(id);
    setArrows(level.arrows.map(a => ({ ...a, points: a.points.map(p => [...p]) })));
    setMoveCount(0);
    setHeartsLost(0);
    setFlyingId(null);
    setShakeArrow(null);
    setBlockedFlyId(null);
    setBlockedFlyProgress(0);
    setBlockedFlyData(null);
    setBlockedRedIds(new Set());
    setShowClueTicker(false);
    lastMoveTimeRef.current = Date.now();
    setUndoState(null);
    setUndoUsed(false);
    setHintArrowId(null);
    setLevelComplete(false);
    setExtractProgress(0);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    if (extractRafRef.current) cancelAnimationFrame(extractRafRef.current);
    if (blockedRafRef.current) cancelAnimationFrame(blockedRafRef.current);
    if (introRafRef.current) cancelAnimationFrame(introRafRef.current);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    if (clueTimeoutRef.current) clearTimeout(clueTimeoutRef.current);
    levelStartTime.current = Date.now();
    setPhase('playing');

    // ── Entrance animation: arrows appear with staggered draw-in ──
    setIntroProgress(0);
    const startTime = performance.now();
    const introDuration = INTRO_DURATION_MS;
    const animateIntro = (now) => {
      const t = Math.min(1, (now - startTime) / introDuration);
      setIntroProgress(t);
      if (t < 1) {
        introRafRef.current = requestAnimationFrame(animateIntro);
      } else {
        introRafRef.current = null;
      }
    };
    introRafRef.current = requestAnimationFrame(animateIntro);
  }, []);

  // ── Pinch-to-zoom touch handlers ──
  const getTouchDist = useCallback((t1, t2) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      pinchRef.current = { active: true, startDist: dist, startZoom: zoom };
      panRef.current.active = false;
    } else if (e.touches.length === 1 && zoom > 1) {
      panRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startPanX: panOffset.x,
        startPanY: panOffset.y,
      };
    }
  }, [getTouchDist, zoom, panOffset]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = dist / pinchRef.current.startDist;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * scale));
      setZoom(newZoom);
    } else if (e.touches.length === 1 && panRef.current.active && zoom > 1) {
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      setPanOffset({
        x: panRef.current.startPanX + dx,
        y: panRef.current.startPanY + dy,
      });
    }
  }, [getTouchDist, zoom]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      pinchRef.current.active = false;
    }
    if (e.touches.length === 0) {
      panRef.current.active = false;
    }
  }, []);

  // ── Mouse wheel zoom ──
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
    }
  }, []);

  // Reset pan when zoom goes to 1
  useEffect(() => {
    if (zoom <= 1) setPanOffset({ x: 0, y: 0 });
  }, [zoom]);

  // Handle arrow tap
  const handleArrowTap = useCallback((arrowId) => {
    if (flyingId || levelComplete || blockedFlyId) return;
    lastMoveTimeRef.current = Date.now();
    setShowClueTicker(false);
    const arrow = arrows.find(a => a.id === arrowId);
    if (!arrow) return;

    const canEscape = escapableIds.has(arrowId);

    if (canEscape) {
      // ✅ Successful extraction
      sounds.ignis();
      vibrate(8);
      setHintArrowId(null);
      setUndoState({ arrows: deepCopyArrows(arrows), heartLost: false });
      setUndoUsed(false);
      setFlyingId(arrowId);
      setMoveCount(m => m + 1);

      // Snake extraction animation via requestAnimationFrame
      const startTime = performance.now();
      const duration = EXTRACT_DURATION_MS;

      const animate = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Ease-out curve for natural deceleration
        const eased = 1 - (1 - t) * (1 - t);
        setExtractProgress(eased);

        // Spawn soft ignis particles at tail position
        const nowMs = performance.now();
        const flyArrow = arrowsRef.current.find(a => a.id === arrowId);
        if (flyArrow && eased > 0.02) {
          const escDir = getEscapeDir(flyArrow);
          const tip = flyArrow.points[flyArrow.points.length - 1];
          const exitDist = Math.max(currentLevel.gridW, currentLevel.gridH) + 5;
          const extPts = [...flyArrow.points];
          extPts.push([tip[0] + escDir.dx * exitDist, tip[1] + escDir.dy * exitDist]);
          const tLen = polylineLength(extPts);
          const tailPos = eased * tLen;
          const tailWorldPts = slicePolyline(extPts, tailPos, tailPos + 0.01);
          if (tailWorldPts.length > 0) {
            const [tx, ty] = tailWorldPts[0];
            const cs = cellSizeRef.current || 40;
            for (let pi = 0; pi < IGNIS_SPAWN_RATE; pi++) {
              const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // mostly upward
              const speed = 0.15 + Math.random() * 0.3;
              smokeParticlesRef.current.push({
                x: tx * cs + (Math.random() - 0.5) * cs * 0.15,
                y: ty * cs + (Math.random() - 0.5) * cs * 0.15,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.3, // gentle rise
                born: nowMs,
                size: 1.5 + Math.random() * 2.5,
                color: IGNIS_COLORS[Math.floor(Math.random() * IGNIS_COLORS.length)],
              });
            }
          }
        }
        // Prune dead particles
        smokeParticlesRef.current = smokeParticlesRef.current.filter(
          p => nowMs - p.born < IGNIS_LIFETIME_MS
        );

        if (t < 1) {
          extractRafRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete — remove arrow
          setExtractProgress(0);
          setFlyingId(null);
          smokeParticlesRef.current = []; // clear particles when done
          setArrows(prev => {
            const remaining = prev.filter(a => a.id !== arrowId);
            if (remaining.length === 0) {
              sounds.score();
              vibrate([20, 10, 30, 10, 20]);
              setLevelComplete(true);
              setProgress(prev2 => {
                const next = { ...prev2, completed: { ...prev2.completed } };
                next.completed[currentLevelId] = { moves: moveCount + 1, heartsLost };
                next.unlocked = Math.max(next.unlocked, currentLevelId + 1);
                saveProgress(next);
                return next;
              });
            }
            return remaining;
          });
        }
      };

      extractRafRef.current = requestAnimationFrame(animate);
    } else {
      // ❌ Blocked — fly toward blocker, bounce back, shake, turn red
      const escDir = getEscapeDir(arrow);
      const blockerDist = getBlockerDistance(arrow, arrows, currentLevel.gridW, currentLevel.gridH);
      if (blockerDist <= 0) return; // safety

      sounds.tap();
      vibrate(8);
      setUndoState({ arrows: deepCopyArrows(arrows), heartLost: true });
      setUndoUsed(false);
      setBlockedFlyId(arrowId);
      setBlockedFlyData({ escDir, blockerDist });
      setBlockedFlyProgress(0);

      // Animate: 0→1 = fly out toward blocker, 1→2 = snap back
      const startTime = performance.now();
      const flyOutDuration = BLOCKED_FLY_MS;
      const pauseDuration = BLOCKED_PAUSE_MS;
      const retractDuration = BLOCKED_RETRACT_MS;
      const totalDuration = flyOutDuration + pauseDuration + retractDuration;

      const animateBlocked = (now) => {
        const elapsed = now - startTime;

        if (elapsed < flyOutDuration) {
          // Phase 1: fly out (ease out)
          const t = elapsed / flyOutDuration;
          const eased = 1 - (1 - t) * (1 - t); // ease-out
          setBlockedFlyProgress(eased); // 0→1
        } else if (elapsed < flyOutDuration + pauseDuration) {
          // Phase 2: pause near blocker
          setBlockedFlyProgress(1);
        } else if (elapsed < totalDuration) {
          // Phase 3: retract back (ease in)
          const t = (elapsed - flyOutDuration - pauseDuration) / retractDuration;
          const eased = t * t; // ease-in (accelerate back)
          setBlockedFlyProgress(1 + eased); // 1→2
        } else {
          // Animation complete — shake and turn red
          setBlockedFlyProgress(0);
          setBlockedFlyId(null);
          setBlockedFlyData(null);
          blockedRafRef.current = null;

          vibrate([25, 10, 25]);
          setShakeArrow(arrowId);
          setBlockedRedIds(prev => new Set(prev).add(arrowId));
          setHeartsLost(h => h + 1);
          if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
          shakeTimeoutRef.current = setTimeout(() => setShakeArrow(null), SHAKE_DURATION_MS);

          setHeartsData(prev => {
            const newCount = Math.max(0, prev.count - 1);
            const nd = { count: newCount, lastUpdate: prev.count >= MAX_HEARTS ? Date.now() : prev.lastUpdate };
            saveHearts(nd);
            if (newCount === 0) setTimeout(() => setPhase('outOfHearts'), 800);
            return nd;
          });
          return;
        }

        blockedRafRef.current = requestAnimationFrame(animateBlocked);
      };

      blockedRafRef.current = requestAnimationFrame(animateBlocked);
    }
  }, [arrows, escapableIds, flyingId, levelComplete, blockedFlyId, moveCount, heartsLost, currentLevelId, currentLevel]);

  // Undo (first free, refunds heart)
  const handleUndo = useCallback(() => {
    if (!undoState || undoUsed || flyingId) return;
    setArrows(undoState.arrows);
    setBlockedRedIds(new Set()); // clear red on undo
    setUndoUsed(true);
    setMoveCount(m => Math.max(0, m - 1));
    sounds.tap();
    if (undoState.heartLost) {
      setHeartsData(prev => {
        const nd = { ...prev, count: Math.min(MAX_HEARTS, prev.count + 1) };
        saveHearts(nd);
        return nd;
      });
      setHeartsLost(h => Math.max(0, h - 1));
    }
  }, [undoState, undoUsed, flyingId]);

  // Restart
  const handleRestart = useCallback(() => {
    if (currentLevelId) loadLevel(currentLevelId);
    sounds.tap();
  }, [currentLevelId, loadLevel]);

  // Hint (solver-powered)
  const handleHint = useCallback(() => {
    if (!currentLevel || progress.hints <= 0 || flyingId) return;
    const solution = solve(
      deepCopyArrows(arrows),
      currentLevel.gridW, currentLevel.gridH
    );
    if (solution && solution.length > 0) {
      setHintArrowId(solution[0].id);
      sounds.tap();
      setProgress(prev => {
        const next = { ...prev, hints: prev.hints - 1 };
        saveProgress(next);
        return next;
      });
      setTimeout(() => setHintArrowId(null), HINT_DURATION_MS);
    }
  }, [currentLevel, arrows, progress.hints, flyingId]);

  // Clue ticker tap — highlight first escapable arrow (instant, no solver needed)
  const handleClueTap = useCallback(() => {
    if (!currentLevel || flyingId || blockedFlyId || hintArrowId) return;
    // Try solver first (fast levels), fall back to first legal move
    const solution = solve(
      deepCopyArrows(arrows),
      currentLevel.gridW, currentLevel.gridH
    );
    let targetId = null;
    if (solution && solution.length > 0) {
      targetId = solution[0].id;
    } else {
      // Solver timed out — just show any escapable arrow
      const legal = getLegalMoves(arrows, currentLevel.gridW, currentLevel.gridH);
      if (legal.length > 0) targetId = legal[0].id;
    }
    if (targetId) {
      setHintArrowId(targetId);
      sounds.tap();
      setShowClueTicker(false);
      lastMoveTimeRef.current = Date.now();
      setTimeout(() => setHintArrowId(null), HINT_DURATION_MS);
    }
  }, [currentLevel, arrows, flyingId, blockedFlyId, hintArrowId]);

  // Next level
  const handleNext = useCallback(() => {
    const nextId = currentLevelId + 1;
    if (nextId <= LEVELS.length) loadLevel(nextId);
    else setPhase('levelSelect');
  }, [currentLevelId, loadLevel]);

  // ─── Render arrow ───
  const renderArrow = (arrow) => {
    const cs = cellSize;
    const isHint = hintArrowId === arrow.id;
    const isFlying = flyingId === arrow.id;
    const isShaking = shakeArrow === arrow.id;
    const isBlockedFlying = blockedFlyId === arrow.id;
    const strokeW = Math.max(4, cs * 0.18);
    const cornerR = cs * 0.22;
    const isBlockedRed = blockedRedIds.has(arrow.id);
    const color = (isShaking || isBlockedRed) ? ARROW_BLOCKED : isHint ? ARROW_HINT : ARROW_COLOR;
    const pts = arrow.points;

    // ── Grid-following extraction animation ──
    if (isFlying && extractProgress > 0) {
      const escDir = getEscapeDir(arrow);
      const tip = pts[pts.length - 1];
      const exitDist = Math.max(currentLevel.gridW, currentLevel.gridH) + 5;
      const extPoints = [...pts];
      extPoints.push([tip[0] + escDir.dx * exitDist, tip[1] + escDir.dy * exitDist]);

      const totalLen = polylineLength(extPoints);
      const origLen = polylineLength(pts);
      const headPos = origLen + extractProgress * (totalLen - origLen);
      const tailPos = extractProgress * totalLen;
      if (tailPos >= headPos) return null;

      const visiblePts = slicePolyline(extPoints, tailPos, headPos);
      if (visiblePts.length < 2) return null;

      const vPts = visiblePts.map(p => [...p]);
      insetTail(vPts);
      insetTipForArrowhead(vPts, cs);
      const animPathD = buildArrowPath(vPts, cs, cornerR);
      const head = computeArrowhead(vPts, cs);

      return (
        <g key={arrow.id}>
          <path d={animPathD} stroke={color} strokeWidth={strokeW} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
          <polygon points={head.points} fill={color} />
        </g>
      );
    }

    // ── Blocked fly animation: snake lunge toward blocker, then retract ──
    if (isBlockedFlying && blockedFlyData && blockedFlyProgress > 0) {
      const { escDir, blockerDist } = blockedFlyData;
      const tip = pts[pts.length - 1];

      const stopDist = Math.max(0.2, blockerDist - BLOCKER_GAP);
      const extPoints = [...pts];
      for (let i = 1; i < blockerDist; i++) {
        if (i < stopDist) {
          extPoints.push([tip[0] + escDir.dx * i, tip[1] + escDir.dy * i]);
        }
      }
      extPoints.push([tip[0] + escDir.dx * stopDist, tip[1] + escDir.dy * stopDist]);

      const totalLen = polylineLength(extPoints);
      const origLen = polylineLength(pts);
      const extLen = totalLen - origLen;

      const slideT = blockedFlyProgress <= 1 ? blockedFlyProgress : 2 - blockedFlyProgress;
      const headT = Math.min(1, slideT * SNAKE_HEAD_SPEED);
      const tailT = Math.max(0, slideT * SNAKE_TAIL_SPEED);

      const headPos = origLen + headT * extLen;
      const tailPos = tailT * extLen;
      if (tailPos >= headPos || headPos > totalLen + 0.01) return null;

      const clampedHead = Math.min(headPos, totalLen);
      const visiblePts = slicePolyline(extPoints, tailPos, clampedHead);
      if (visiblePts.length < 2) return null;

      const vPts = visiblePts.map(p => [...p]);
      insetTail(vPts);
      insetTipForArrowhead(vPts, cs);
      const animPathD = buildArrowPath(vPts, cs, cornerR);
      const head = computeArrowhead(vPts, cs);

      const nearness = blockedFlyProgress <= 1 ? blockedFlyProgress : (2 - blockedFlyProgress);
      const blockedColor = nearness > 0.5 ? ARROW_BLOCKED : ARROW_COLOR;

      return (
        <g key={arrow.id}>
          <path d={animPathD} stroke={blockedColor} strokeWidth={strokeW} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
          <polygon points={head.points} fill={blockedColor} />
        </g>
      );
    }

    // ── Normal (static) rendering ──
    // Inset points for clean gap between arrows + arrowhead
    const insetPts = pts.map(p => [...p]);
    const tailDirX = Math.sign(insetPts[1][0] - insetPts[0][0]);
    const tailDirY = Math.sign(insetPts[1][1] - insetPts[0][1]);
    insetPts[0] = [insetPts[0][0] + tailDirX * GAP, insetPts[0][1] + tailDirY * GAP];
    insetTipForArrowhead(insetPts, cs); // path ends at arrowhead base
    const bodyPathD = buildArrowPath(insetPts, cs, cornerR);
    const head = computeArrowhead(pts.map(p => [...p]), cs);

    // Intro animation
    const arrowIndex = currentLevel ? currentLevel.arrows.findIndex(a => a.id === arrow.id) : 0;
    const arrowCount = currentLevel ? currentLevel.arrows.length : 1;
    const introStart = (arrowIndex / arrowCount) * 0.6;
    const introEnd = introStart + 0.4;
    const arrowIntro = Math.max(0, Math.min(1, (introProgress - introStart) / (introEnd - introStart)));
    if (arrowIntro <= 0 && introProgress < 1) return null;

    const centerX = pts.reduce((s, p) => s + p[0], 0) / pts.length * cs;
    const centerY = pts.reduce((s, p) => s + p[1], 0) / pts.length * cs;
    const introOpacity = introProgress >= 1 ? 1 : arrowIntro;
    const introScale = introProgress >= 1 ? 1 : 0.3 + arrowIntro * 0.7;

    return (
      <g
        key={arrow.id}
        onClick={(e) => { e.stopPropagation(); handleArrowTap(arrow.id); }}
        style={{
          cursor: introProgress >= 1 ? 'pointer' : 'default',
          animation: isShaking ? 'arrowShake 0.5s ease' : 'none',
          opacity: introOpacity,
          transform: introScale < 1 ? `scale(${introScale})` : undefined,
          transformOrigin: introScale < 1 ? `${centerX}px ${centerY}px` : undefined,
          pointerEvents: introProgress >= 1 ? 'auto' : 'none',
        }}
      >
        {/* Tap target */}
        <path d={buildArrowPath(pts, cs, cornerR)} stroke="transparent" strokeWidth={cs * 0.45} fill="none" />

        {/* Hint glow */}
        {isHint && (
          <path d={bodyPathD} stroke={ARROW_HINT} strokeWidth={strokeW + 6} fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity={0.25}>
            <animate attributeName="opacity" values="0.1;0.35;0.1" dur="1s" repeatCount="indefinite" />
          </path>
        )}

        {/* Arrow body */}
        <path d={bodyPathD} stroke={color} strokeWidth={strokeW} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Arrowhead */}
        <polygon points={head.points} fill={color} />
      </g>
    );
  };

  // ═══ Level Select ═══
  if (phase === 'levelSelect') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG_COLOR, color: ARROW_COLOR }}>
        <div style={{
          padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: 1 }}>
            LEVEL SELECT
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HeartsHUD hearts={heartsData.count} maxHearts={MAX_HEARTS} regenTimeLeft={regenSeconds} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: '#999' }}>💡{progress.hints}</span>
          </div>
        </div>
        <div style={{
          flex: 1, padding: '12px', display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, alignContent: 'start', overflowY: 'auto',
        }}>
          {LEVELS.map(level => {
            const unlocked = level.id <= progress.unlocked;
            const completed = !!progress.completed[level.id];
            return (
              <button key={level.id}
                onClick={() => {
                  if (!unlocked) return;
                  if (heartsData.count <= 0) { setPhase('outOfHearts'); return; }
                  loadLevel(level.id);
                }}
                style={{
                  aspectRatio: '1', borderRadius: 12,
                  background: completed ? 'rgba(80,200,120,0.06)' : unlocked ? '#fff' : 'rgba(0,0,0,0.02)',
                  border: completed ? '2px solid rgba(80,200,120,0.25)' : unlocked ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(0,0,0,0.03)',
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 2, transition: 'all 0.15s', opacity: unlocked ? 1 : 0.3,
                }}>
                {unlocked ? (
                  <>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800,
                      color: completed ? '#50C878' : ARROW_COLOR,
                    }}>{level.id}</span>
                    {completed && <span style={{ fontSize: 9, color: '#50C878' }}>✓</span>}
                  </>
                ) : (
                  <span style={{ fontSize: 13, opacity: 0.5 }}>🔒</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ Out of Hearts ═══
  if (phase === 'outOfHearts') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        alignItems: 'center', justifyContent: 'center',
        background: BG_COLOR, color: ARROW_COLOR, gap: 14,
      }}>
        <div style={{ fontSize: 48 }}>💔</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900 }}>OUT OF HEARTS</div>
        <div style={{ fontSize: 13, color: '#999', textAlign: 'center', maxWidth: 250, lineHeight: 1.5 }}>
          Hearts regenerate over time.<br/>Come back in a few minutes!
        </div>
        <HeartsHUD hearts={heartsData.count} maxHearts={MAX_HEARTS} regenTimeLeft={regenSeconds} />
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={() => { setPhase('levelSelect'); sounds.tap(); }} style={{
            padding: '12px 28px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12, color: '#666', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>BACK</button>
          {heartsData.count > 0 && (
            <button onClick={() => { setPhase('playing'); sounds.tap(); }} style={{
              padding: '12px 28px', background: ARROW_COLOR, border: 'none', borderRadius: 12,
              color: '#fff', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}>CONTINUE</button>
          )}
        </div>
      </div>
    );
  }

  // ═══ Level Complete ═══
  if (levelComplete) {
    const perfect = heartsLost === 0;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        alignItems: 'center', justifyContent: 'center',
        background: BG_COLOR, color: ARROW_COLOR, gap: 14,
        animation: 'arrowFadeInUp 0.4s ease',
      }}>
        <div style={{ fontSize: 52, animation: 'arrowPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          {perfect ? '⭐' : '🎉'}
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
          letterSpacing: 2, color: perfect ? '#FFB800' : '#50C878',
        }}>{perfect ? 'PERFECT!' : 'CLEARED!'}</div>
        <div style={{ fontSize: 12, color: '#999', fontFamily: 'var(--font-display)' }}>
          Level {currentLevelId} · {moveCount} moves
          {heartsLost > 0 && ` · ${heartsLost} ❤️ lost`}
        </div>
        <HeartsHUD hearts={heartsData.count} maxHearts={MAX_HEARTS} regenTimeLeft={0} />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={() => { setPhase('levelSelect'); sounds.tap(); }} style={{
            padding: '12px 24px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12, color: '#666', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>LEVELS</button>
          <button onClick={handleRestart} style={{
            padding: '12px 24px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12, color: '#666', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>RETRY</button>
          {currentLevelId < LEVELS.length && (
            <button onClick={handleNext} style={{
              padding: '12px 32px', background: ARROW_COLOR, border: 'none', borderRadius: 12,
              color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(26,26,46,0.3)',
            }}>NEXT →</button>
          )}
        </div>
      </div>
    );
  }

  // ═══ Playing ═══
  if (!currentLevel) return null;
  const cs = cellSize;
  const svgW = currentLevel.gridW * cs;
  const svgH = currentLevel.gridH * cs;
  const margin = Math.max(8, cs * 0.2); // padding so edge dots are visible

  return (
    <div ref={containerRef} style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: BG_COLOR, color: ARROW_COLOR,
      userSelect: 'none', WebkitUserSelect: 'none',
      position: 'relative',
    }}>
      {/* HUD */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setPhase('levelSelect'); sounds.tap(); }} style={{
            width: 30, height: 30, borderRadius: 8, background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#999',
          }}>⚙</button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800 }}>
            Level {currentLevelId}
          </div>
        </div>
        <HeartsHUD hearts={heartsData.count} maxHearts={MAX_HEARTS} regenTimeLeft={regenSeconds} />
      </div>

      {/* Progress bar */}
      {(() => {
        const totalArrows = currentLevel.arrows.length;
        const removed = totalArrows - arrows.length;
        const pct = totalArrows > 0 ? (removed / totalArrows) * 100 : 0;
        return (
          <div style={{
            width: '100%', height: 3, background: 'rgba(0,0,0,0.06)',
            position: 'relative', flexShrink: 0,
          }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #4A6CF7, #7B5EF7)',
              borderRadius: '0 2px 2px 0',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        );
      })()}

      {/* Board */}
      <div
        ref={boardWrapRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', touchAction: zoom > 1 ? 'none' : 'pan-y',
          position: 'relative',
        }}
      >
        <div style={{
          transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
          transformOrigin: 'center center',
          transition: pinchRef.current?.active ? 'none' : 'transform 0.1s ease-out',
          willChange: 'transform',
        }}>
          <svg
            width={svgW + margin * 2}
            height={svgH + margin * 2}
            viewBox={`${-margin} ${-margin} ${svgW + margin * 2} ${svgH + margin * 2}`}
            style={{ overflow: 'visible' }}
          >
            {/* SVG filters for ignis glow */}
            <defs>
              <radialGradient id="ignisGrad">
                <stop offset="0%" stopColor="#FFF8E1" stopOpacity="0.9" />
                <stop offset="40%" stopColor="#FFB347" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Grid dots — only at positions occupied by arrows */}
            {[...occupiedDots].map(key => {
              const [x, y] = key.split(',').map(Number);
              return (
                <circle key={`dot-${x}-${y}`} cx={x * cs} cy={y * cs}
                  r={Math.max(2.5, cs * 0.045)}
                  fill="rgba(0,0,0,0.18)" />
              );
            })}
            {/* Arrows (rendered ON TOP of dots) */}
            {arrows.map(arrow => renderArrow(arrow))}
            {/* Soft ignis trail during extraction */}
            {flyingId && smokeParticlesRef.current.length > 0 && (() => {
              const now = performance.now();
              return smokeParticlesRef.current.map((p, i) => {
                const age = now - p.born;
                const lifeT = Math.min(1, age / IGNIS_LIFETIME_MS);
                const px = p.x + p.vx * age * 0.05;
                const py = p.y + p.vy * age * 0.05;
                // Soft glow: starts bright, fades and grows slightly
                const opacity = Math.max(0, 0.7 * (1 - lifeT * lifeT));
                const scale = 1 + lifeT * 0.8;
                return (
                  <circle key={`ignis-${i}`}
                    cx={px} cy={py}
                    r={p.size * scale}
                    fill="url(#ignisGrad)"
                    opacity={opacity}
                  />
                );
              });
            })()}
          </svg>
        </div>
      </div>

      {/* Clue ticker — slides in from left after 4s idle */}
      {showClueTicker && !levelComplete && arrows.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleClueTap(); }}
          style={{
            position: 'absolute', left: 0, top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 14px 8px 10px',
            background: 'rgba(74, 108, 247, 0.95)',
            color: '#fff',
            border: 'none',
            borderRadius: '0 20px 20px 0',
            fontFamily: 'var(--font-display)',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '2px 2px 12px rgba(74,108,247,0.3)',
            animation: 'clueSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            letterSpacing: 0.5,
          }}
        >
          <span style={{ fontSize: 15 }}>💡</span>
          Clue
        </button>
      )}

      {/* Zoom slider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 20px 2px',
        background: 'rgba(255,255,255,0.5)',
      }}>
        <span style={{ fontSize: 12, color: '#999', fontFamily: 'var(--font-display)', minWidth: 16 }}>🔍</span>
        <input
          type="range"
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          style={{
            flex: 1, height: 4, appearance: 'none', WebkitAppearance: 'none',
            background: `linear-gradient(to right, ${ARROW_COLOR} 0%, ${ARROW_COLOR} ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, rgba(0,0,0,0.1) ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, rgba(0,0,0,0.1) 100%)`,
            borderRadius: 4, outline: 'none', cursor: 'pointer',
          }}
        />
        <span style={{
          fontSize: 10, color: '#999', fontFamily: 'var(--font-display)',
          minWidth: 30, textAlign: 'right',
        }}>{Math.round(zoom * 100)}%</span>
        {zoom !== 1 && (
          <button
            onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 6,
              background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)',
              color: '#666', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700,
            }}
          >RESET</button>
        )}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 12, padding: '10px 14px', borderTop: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.5)',
      }}>
        <button onClick={handleUndo} disabled={!undoState || undoUsed || !!flyingId} style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)',
          color: undoState && !undoUsed ? ARROW_COLOR : 'rgba(0,0,0,0.12)',
          fontSize: 17, cursor: undoState && !undoUsed ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>↩</button>

        <button onClick={handleRestart} style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)',
          color: ARROW_COLOR, fontSize: 17, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>↻</button>

        <button onClick={handleHint} disabled={progress.hints <= 0 || !!flyingId} style={{
          width: 42, height: 42, borderRadius: 12,
          background: progress.hints > 0 ? 'rgba(255,215,0,0.08)' : 'rgba(0,0,0,0.04)',
          border: progress.hints > 0 ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(0,0,0,0.06)',
          color: progress.hints > 0 ? '#B8860B' : 'rgba(0,0,0,0.12)',
          fontSize: 15, cursor: progress.hints > 0 ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          💡
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: progress.hints > 0 ? '#FFB800' : '#ccc',
            color: '#fff', fontSize: 8, fontWeight: 800,
            width: 15, height: 15, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{progress.hints}</span>
        </button>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#999', textAlign: 'center', marginLeft: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: ARROW_COLOR }}>{moveCount}</div>
          moves
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#999', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: ARROW_COLOR }}>{arrows.length}</div>
          left
        </div>
      </div>

      <style jsx>{`
        @keyframes arrowShake {
          0% { transform: translateX(0); filter: none; }
          15% { transform: translateX(-8px) rotate(-2deg); }
          30% { transform: translateX(7px) rotate(1.5deg); }
          45% { transform: translateX(-5px) rotate(-1deg); }
          60% { transform: translateX(4px) rotate(0.8deg); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(1px); }
          100% { transform: translateX(0); }
        }
        @keyframes arrowFadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes clueSlideIn {
          from { transform: translateX(-100%) translateY(-50%); opacity: 0; }
          to { transform: translateX(0) translateY(-50%); opacity: 1; }
        }
        @keyframes arrowPopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${ARROW_COLOR};
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        input[type='range']::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${ARROW_COLOR};
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
