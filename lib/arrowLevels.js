/**
 * Arrow Escape — Level Data + Solver + Generator
 * 
 * Arrows are LINE segments with a tail and an arrowhead tip.
 * Each arrow is defined by waypoints: [[col,row], [col,row], ...]
 * The first point is the tail, the last is the arrowhead.
 * The arrow "escapes" by flying in the direction of its last segment.
 * 
 * It can only escape if no other arrow's cells block the path
 * from the tip to the edge of the board in that direction.
 */

// ─── Get all grid cells an arrow occupies ───
export function getArrowCells(arrow) {
  const cells = new Set();
  const pts = arrow.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let cx = x1, cy = y1;
    while (cx !== x2 || cy !== y2) {
      cells.add(`${cx},${cy}`);
      cx += dx;
      cy += dy;
    }
    cells.add(`${x2},${y2}`);
  }
  return cells;
}

// ─── Get escape direction (direction of last segment) ───
export function getEscapeDir(arrow) {
  const pts = arrow.points;
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return {
    dx: Math.sign(last[0] - prev[0]),
    dy: Math.sign(last[1] - prev[1]),
  };
}

// ─── Check if arrow can escape ───
// An arrow escapes by sliding its ENTIRE body in the escape direction.
// Every cell the arrow occupies sweeps forward — all sweep paths must be clear.
export function canArrowEscape(arrow, allArrows, gridW, gridH) {
  const otherCells = new Set();
  for (const a of allArrows) {
    if (a.id !== arrow.id) {
      for (const c of getArrowCells(a)) otherCells.add(c);
    }
  }
  const ownCells = getArrowCells(arrow);
  const { dx, dy } = getEscapeDir(arrow);

  // For each cell the arrow occupies, check the sweep path in escape direction
  for (const cellKey of ownCells) {
    const [cx, cy] = cellKey.split(',').map(Number);
    let sx = cx + dx;
    let sy = cy + dy;
    while (sx >= 0 && sy >= 0 && sx < gridW && sy < gridH) {
      // Only check cells NOT occupied by the arrow itself
      if (!ownCells.has(`${sx},${sy}`) && otherCells.has(`${sx},${sy}`)) {
        return false;
      }
      sx += dx;
      sy += dy;
    }
  }
  return true;
}

// ─── Find distance to blocker (in grid cells from tip) ───
// Checks ALL body cells sweeping in escape direction, returns nearest hit.
export function getBlockerDistance(arrow, allArrows, gridW, gridH) {
  const otherCells = new Set();
  for (const a of allArrows) {
    if (a.id !== arrow.id) {
      for (const c of getArrowCells(a)) otherCells.add(c);
    }
  }
  const ownCells = getArrowCells(arrow);
  const { dx, dy } = getEscapeDir(arrow);
  const tip = arrow.points[arrow.points.length - 1];
  let minDist = Infinity;

  // For each cell the arrow occupies, find how far it can go before hitting a blocker
  for (const cellKey of ownCells) {
    const [cx, cy] = cellKey.split(',').map(Number);
    let sx = cx + dx;
    let sy = cy + dy;
    let dist = 1;
    while (sx >= 0 && sy >= 0 && sx < gridW && sy < gridH) {
      if (!ownCells.has(`${sx},${sy}`) && otherCells.has(`${sx},${sy}`)) {
        // Convert to distance from tip: how far does the tip travel when this cell hits the blocker
        // The tip is at (tip[0], tip[1]), this body cell is at (cx, cy)
        // When the body cell moves 'dist' steps, the tip also moves 'dist' steps
        if (dist < minDist) minDist = dist;
        break;
      }
      sx += dx;
      sy += dy;
      dist++;
    }
  }
  return minDist === Infinity ? -1 : minDist;
}

// ─── Solver (with time limit) ───
export function solve(arrows, gridW, gridH, _deadline) {
  if (arrows.length === 0) return [];
  const deadline = _deadline || Date.now() + 200; // 200ms max
  for (const arrow of arrows) {
    if (Date.now() > deadline) return null; // timeout
    if (canArrowEscape(arrow, arrows, gridW, gridH)) {
      const rest = arrows.filter(a => a.id !== arrow.id);
      const sub = solve(rest, gridW, gridH, deadline);
      if (sub !== null) return [arrow, ...sub];
    }
  }
  return null;
}

// ─── Get legal moves ───
export function getLegalMoves(arrows, gridW, gridH) {
  return arrows.filter(a => canArrowEscape(a, arrows, gridW, gridH));
}

// ═══════════════════════════════════════════════════
// ─── LEVEL DATA — 60 levels ───
// Hard levels at x0 and x6 (10, 16, 20, 26, 30, etc.)
// ═══════════════════════════════════════════════════

export const LEVELS = [
  // ── Level 1: 3 parallel UP arrows ──
  { id: 1, gridW: 5, gridH: 7, arrows: [
    { id: 'a', points: [[1,5],[1,1]] },
    { id: 'b', points: [[2,6],[2,2]] },
    { id: 'c', points: [[3,5],[3,1]] },
  ]},

  // ── Level 2: L-shaped staircase ──
  { id: 2, gridW: 5, gridH: 7, arrows: [
    { id: 'a', points: [[0,5],[0,2],[1,2]] },
    { id: 'b', points: [[2,5],[2,2],[3,2]] },
    { id: 'c', points: [[4,4],[4,1]] },
  ]},

  // ── Level 3 — 5x6, 4 arrows ──
  { id: 3, gridW: 5, gridH: 6, arrows: [
    { id: 'a', points: [[2,1],[4,1]] },
    { id: 'b', points: [[2,4],[2,2]] },
    { id: 'c', points: [[1,4],[1,2]] },
    { id: 'd', points: [[3,2],[3,4]] },
  ]},

  // ── Level 4 — 7x7, 5 arrows ──
  { id: 4, gridW: 7, gridH: 7, arrows: [
    { id: 'a', points: [[3,4],[3,1]] },
    { id: 'b', points: [[2,2],[2,5]] },
    { id: 'c', points: [[4,4],[4,0]] },
    { id: 'd', points: [[2,1],[0,1]] },
    { id: 'e', points: [[5,5],[5,1]] },
  ]},

  // ── Level 5 — 9x10, 8 arrows ──
  { id: 5, gridW: 9, gridH: 10, arrows: [
    { id: 'a', points: [[3,6],[3,2]] },
    { id: 'b', points: [[4,6],[4,8],[8,8]] },
    { id: 'c', points: [[1,2],[1,0]] },
    { id: 'd', points: [[4,1],[6,1]] },
    { id: 'e', points: [[0,5],[2,5],[2,1]] },
    { id: 'f', points: [[6,7],[6,4]] },
    { id: 'g', points: [[7,7],[7,3]] },
    { id: 'h', points: [[6,3],[4,3]] },
  ]},

  // ── Level 6 — 10x10, 10 arrows ──
  { id: 6, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[2,6],[2,2]] },
    { id: 'b', points: [[8,6],[8,8]] },
    { id: 'c', points: [[7,5],[7,9]] },
    { id: 'd', points: [[5,8],[3,8]] },
    { id: 'e', points: [[2,7],[0,7]] },
    { id: 'f', points: [[6,4],[6,5],[3,5]] },
    { id: 'g', points: [[6,7],[6,9]] },
    { id: 'h', points: [[8,3],[8,2],[5,2]] },
    { id: 'i', points: [[7,1],[4,1]] },
    { id: 'j', points: [[3,4],[3,2]] },
  ]},

  // ── Level 7 — 7x8, 6 arrows ──
  { id: 7, gridW: 7, gridH: 8, arrows: [
    { id: 'a', points: [[3,4],[0,4]] },
    { id: 'b', points: [[4,2],[4,0]] },
    { id: 'c', points: [[2,6],[6,6]] },
    { id: 'd', points: [[5,3],[1,3]] },
    { id: 'e', points: [[5,5],[2,5]] },
    { id: 'f', points: [[2,1],[0,1]] },
  ]},

  // ── Level 8 — 10x11, 10 arrows ──
  { id: 8, gridW: 10, gridH: 11, arrows: [
    { id: 'a', points: [[5,6],[3,6]] },
    { id: 'b', points: [[3,5],[3,1]] },
    { id: 'c', points: [[1,2],[1,4]] },
    { id: 'd', points: [[9,3],[7,3],[7,1]] },
    { id: 'e', points: [[6,8],[2,8]] },
    { id: 'f', points: [[1,7],[1,9]] },
    { id: 'g', points: [[6,6],[6,4]] },
    { id: 'h', points: [[6,9],[4,9]] },
    { id: 'i', points: [[7,9],[7,5]] },
    { id: 'j', points: [[4,4],[4,1]] },
  ]},

  // ── Level 9 — 10x12, 12 arrows ──
  { id: 9, gridW: 10, gridH: 12, arrows: [
    { id: 'a', points: [[3,10],[7,10]] },
    { id: 'b', points: [[4,1],[5,1],[5,3]] },
    { id: 'c', points: [[2,6],[2,7],[5,7]] },
    { id: 'd', points: [[8,4],[8,1]] },
    { id: 'e', points: [[3,9],[1,9]] },
    { id: 'f', points: [[2,4],[2,0]] },
    { id: 'g', points: [[7,7],[7,5]] },
    { id: 'h', points: [[6,7],[6,2]] },
    { id: 'i', points: [[5,4],[3,4]] },
    { id: 'j', points: [[1,7],[1,5]] },
    { id: 'k', points: [[6,8],[4,8]] },
    { id: 'l', points: [[8,10],[8,5]] },
  ]},

  // ── Level 10 [HARD] — 10x10, 12 arrows ──
  { id: 10, gridW: 10, gridH: 10, arrows: [
    { id: 'a01', points: [[0,8],[1,8],[1,9]] },
    { id: 'a02', points: [[3,7],[0,7]] },
    { id: 'a03', points: [[2,4],[0,4]] },
    { id: 'a04', points: [[9,7],[8,7],[8,9]] },
    { id: 'a05', points: [[2,1],[5,1],[5,0]] },
    { id: 'a06', points: [[7,1],[7,0]] },
    { id: 'a07', points: [[8,3],[8,0]] },
    { id: 'a08', points: [[3,8],[3,9]] },
    { id: 'a09', points: [[8,4],[8,6],[9,6]] },
    { id: 'a10', points: [[5,8],[5,9]] },
    { id: 'a11', points: [[3,5],[0,5]] },
    { id: 'a12', points: [[1,3],[0,3]] },
  ]},

  // ── Level 11 — 8x9, 9 arrows ──
  { id: 11, gridW: 8, gridH: 9, arrows: [
    { id: 'a01', points: [[6,5],[6,3],[7,3]] },
    { id: 'a02', points: [[4,5],[4,8]] },
    { id: 'a03', points: [[3,6],[0,6]] },
    { id: 'a04', points: [[3,3],[3,0]] },
    { id: 'a05', points: [[6,2],[6,1],[7,1]] },
    { id: 'a06', points: [[5,7],[5,8]] },
    { id: 'a07', points: [[1,1],[1,0]] },
    { id: 'a08', points: [[4,1],[4,0]] },
    { id: 'a09', points: [[7,6],[6,6],[6,8]] },
  ]},

  // ── Level 12 — 8x9, 9 arrows ──
  { id: 12, gridW: 8, gridH: 9, arrows: [
    { id: 'a01', points: [[2,3],[0,3]] },
    { id: 'a02', points: [[2,7],[2,8]] },
    { id: 'a03', points: [[4,5],[5,5],[5,8]] },
    { id: 'a04', points: [[2,6],[0,6]] },
    { id: 'a05', points: [[1,7],[1,8]] },
    { id: 'a06', points: [[4,6],[4,8]] },
    { id: 'a07', points: [[4,4],[0,4]] },
    { id: 'a08', points: [[6,3],[6,0]] },
    { id: 'a09', points: [[6,6],[7,6]] },
  ]},

  // ── Level 13 — 8x10, 10 arrows ──
  { id: 13, gridW: 8, gridH: 10, arrows: [
    { id: 'a', points: [[4,5],[4,1]] },
    { id: 'b', points: [[1,3],[1,1]] },
    { id: 'c', points: [[4,7],[2,7]] },
    { id: 'd', points: [[5,5],[7,5]] },
    { id: 'e', points: [[2,3],[2,1]] },
    { id: 'f', points: [[3,3],[3,5]] },
    { id: 'g', points: [[5,1],[7,1]] },
    { id: 'h', points: [[4,8],[0,8]] },
    { id: 'i', points: [[1,7],[1,4]] },
    { id: 'j', points: [[7,6],[6,6],[6,8]] },
  ]},

  // ── Level 14 — 8x9, 9 arrows ──
  { id: 14, gridW: 8, gridH: 9, arrows: [
    { id: 'a01', points: [[4,4],[4,5],[7,5]] },
    { id: 'a02', points: [[2,2],[4,2],[4,0]] },
    { id: 'a03', points: [[1,6],[1,8]] },
    { id: 'a04', points: [[1,3],[1,0]] },
    { id: 'a05', points: [[6,6],[7,6]] },
    { id: 'a06', points: [[5,2],[7,2]] },
    { id: 'a07', points: [[3,5],[0,5]] },
    { id: 'a08', points: [[6,7],[7,7]] },
    { id: 'a09', points: [[3,3],[7,3]] },
  ]},

  // ── Level 15 — 10x10, 10 arrows ──
  { id: 15, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[4,0],[4,1],[1,1]] },
    { id: 'b', points: [[6,6],[6,5],[3,5]] },
    { id: 'c', points: [[5,4],[9,4]] },
    { id: 'd', points: [[2,8],[2,3]] },
    { id: 'e', points: [[7,1],[7,3],[4,3]] },
    { id: 'f', points: [[8,7],[6,7],[6,9]] },
    { id: 'g', points: [[4,2],[2,2]] },
    { id: 'h', points: [[1,4],[1,8]] },
    { id: 'i', points: [[8,3],[8,0]] },
    { id: 'j', points: [[5,7],[3,7]] },
  ]},

  // ── Level 16 [HARD] — 10x11, 12 arrows ──
  { id: 16, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[7,1],[6,1],[6,0]] },
    { id: 'a02', points: [[1,6],[0,6]] },
    { id: 'a03', points: [[4,1],[4,0]] },
    { id: 'a04', points: [[6,7],[6,6],[9,6]] },
    { id: 'a05', points: [[6,9],[6,10]] },
    { id: 'a06', points: [[1,3],[1,0]] },
    { id: 'a07', points: [[2,1],[2,0]] },
    { id: 'a08', points: [[8,8],[8,10]] },
    { id: 'a09', points: [[7,7],[7,10]] },
    { id: 'a10', points: [[5,5],[9,5]] },
    { id: 'a11', points: [[1,9],[0,9]] },
    { id: 'a12', points: [[6,2],[6,3],[9,3]] },
  ]},

  // ── Level 17 — 9x10, 10 arrows ──
  { id: 17, gridW: 9, gridH: 10, arrows: [
    { id: 'a01', points: [[7,2],[7,0]] },
    { id: 'a02', points: [[2,7],[0,7]] },
    { id: 'a03', points: [[5,5],[5,9]] },
    { id: 'a04', points: [[3,1],[3,0]] },
    { id: 'a05', points: [[7,8],[8,8]] },
    { id: 'a06', points: [[6,4],[8,4]] },
    { id: 'a07', points: [[1,3],[0,3]] },
    { id: 'a08', points: [[4,1],[4,0]] },
    { id: 'a09', points: [[1,8],[1,9]] },
    { id: 'a10', points: [[2,4],[2,5],[0,5]] },
  ]},

  // ── Level 18 — 9x10, 10 arrows ──
  { id: 18, gridW: 9, gridH: 10, arrows: [
    { id: 'a01', points: [[4,2],[8,2]] },
    { id: 'a02', points: [[2,3],[2,5],[0,5]] },
    { id: 'a03', points: [[3,1],[3,0]] },
    { id: 'a04', points: [[1,6],[1,9]] },
    { id: 'a05', points: [[7,3],[8,3]] },
    { id: 'a06', points: [[4,5],[4,9]] },
    { id: 'a07', points: [[1,2],[0,2]] },
    { id: 'a08', points: [[1,1],[1,0]] },
    { id: 'a09', points: [[7,8],[8,8]] },
    { id: 'a10', points: [[6,8],[6,9]] },
  ]},

  // ── Level 19 — 9x10, 10 arrows ──
  { id: 19, gridW: 9, gridH: 10, arrows: [
    { id: 'a01', points: [[3,1],[3,0]] },
    { id: 'a02', points: [[5,5],[8,5]] },
    { id: 'a03', points: [[7,6],[7,9]] },
    { id: 'a04', points: [[4,3],[4,0]] },
    { id: 'a05', points: [[5,8],[5,9]] },
    { id: 'a06', points: [[3,8],[0,8]] },
    { id: 'a07', points: [[1,4],[0,4]] },
    { id: 'a08', points: [[6,1],[7,1],[7,0]] },
    { id: 'a09', points: [[1,7],[0,7]] },
    { id: 'a10', points: [[4,7],[4,9]] },
  ]},

  // ── Level 20 — 10x10, 10 arrows ──
  { id: 20, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[8,3],[6,3]] },
    { id: 'b', points: [[7,5],[7,7]] },
    { id: 'c', points: [[6,4],[6,7]] },
    { id: 'd', points: [[5,7],[2,7]] },
    { id: 'e', points: [[1,4],[1,5],[5,5]] },
    { id: 'f', points: [[5,4],[5,0]] },
    { id: 'g', points: [[4,1],[0,1]] },
    { id: 'h', points: [[8,8],[8,6]] },
    { id: 'i', points: [[2,6],[5,6]] },
    { id: 'j', points: [[4,8],[1,8]] },
  ]},

  // ── Level 21 — 7x8, 6 arrows ──
  { id: 21, gridW: 7, gridH: 8, arrows: [
    { id: 'a', points: [[1,5],[4,5]] },
    { id: 'b', points: [[2,3],[5,3]] },
    { id: 'c', points: [[2,2],[4,2]] },
    { id: 'd', points: [[4,1],[0,1]] },
    { id: 'e', points: [[1,2],[1,4]] },
    { id: 'f', points: [[5,4],[5,7]] },
  ]},

  // ── Level 22 — 8x8, 8 arrows ──
  { id: 22, gridW: 8, gridH: 8, arrows: [
    { id: 'a', points: [[4,4],[4,7]] },
    { id: 'b', points: [[1,5],[1,7]] },
    { id: 'c', points: [[1,3],[5,3]] },
    { id: 'd', points: [[5,6],[7,6]] },
    { id: 'e', points: [[6,1],[6,5]] },
    { id: 'f', points: [[2,4],[2,7]] },
    { id: 'g', points: [[3,6],[3,4]] },
    { id: 'h', points: [[5,2],[2,2]] },
  ]},

  // ── Level 23 — 8x9, 8 arrows ──
  { id: 23, gridW: 8, gridH: 9, arrows: [
    { id: 'a', points: [[3,2],[6,2]] },
    { id: 'b', points: [[5,7],[5,6],[3,6]] },
    { id: 'c', points: [[2,4],[1,4],[1,7]] },
    { id: 'd', points: [[3,4],[6,4]] },
    { id: 'e', points: [[2,3],[2,0]] },
    { id: 'f', points: [[2,5],[2,8]] },
    { id: 'g', points: [[4,3],[6,3]] },
    { id: 'h', points: [[1,3],[1,0]] },
  ]},

  // ── Level 24 — 9x9, 8 arrows ──
  { id: 24, gridW: 9, gridH: 9, arrows: [
    { id: 'a', points: [[4,3],[2,3]] },
    { id: 'b', points: [[4,4],[1,4]] },
    { id: 'c', points: [[6,4],[6,0]] },
    { id: 'd', points: [[7,4],[7,8]] },
    { id: 'e', points: [[2,1],[4,1]] },
    { id: 'f', points: [[7,2],[7,0]] },
    { id: 'g', points: [[3,5],[0,5]] },
    { id: 'h', points: [[2,7],[4,7]] },
  ]},

  // ── Level 25 — 9x10, 9 arrows ──
  { id: 25, gridW: 9, gridH: 10, arrows: [
    { id: 'a', points: [[7,5],[7,2]] },
    { id: 'b', points: [[3,7],[5,7]] },
    { id: 'c', points: [[5,6],[6,6],[6,2]] },
    { id: 'd', points: [[2,6],[2,3]] },
    { id: 'e', points: [[3,5],[3,2]] },
    { id: 'f', points: [[4,4],[4,6]] },
    { id: 'g', points: [[1,8],[3,8]] },
    { id: 'h', points: [[4,1],[7,1]] },
    { id: 'i', points: [[1,7],[1,4]] },
  ]},

  // ── Level 26 — 8x9, 8 arrows ──
  { id: 26, gridW: 8, gridH: 9, arrows: [
    { id: 'a', points: [[6,4],[6,2]] },
    { id: 'b', points: [[0,7],[1,7],[1,5]] },
    { id: 'c', points: [[1,3],[4,3]] },
    { id: 'd', points: [[4,4],[4,7]] },
    { id: 'e', points: [[5,6],[5,3]] },
    { id: 'f', points: [[1,1],[6,1]] },
    { id: 'g', points: [[3,2],[0,2]] },
    { id: 'h', points: [[5,8],[5,7],[7,7]] },
  ]},

  // ── Level 27 — 9x9, 9 arrows ──
  { id: 27, gridW: 9, gridH: 9, arrows: [
    { id: 'a', points: [[3,4],[6,4]] },
    { id: 'b', points: [[7,3],[5,3]] },
    { id: 'c', points: [[1,7],[1,5]] },
    { id: 'd', points: [[6,1],[3,1]] },
    { id: 'e', points: [[2,6],[2,3]] },
    { id: 'f', points: [[4,8],[4,7],[6,7]] },
    { id: 'g', points: [[5,5],[3,5]] },
    { id: 'h', points: [[7,7],[7,5]] },
    { id: 'i', points: [[4,2],[7,2]] },
  ]},

  // ── Level 28 — 10x10, 9 arrows ──
  { id: 28, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[6,6],[6,8]] },
    { id: 'b', points: [[4,4],[8,4]] },
    { id: 'c', points: [[4,5],[6,5]] },
    { id: 'd', points: [[5,1],[7,1],[7,3]] },
    { id: 'e', points: [[3,6],[3,8]] },
    { id: 'f', points: [[4,7],[4,9]] },
    { id: 'g', points: [[6,3],[4,3]] },
    { id: 'h', points: [[2,7],[0,7]] },
    { id: 'i', points: [[2,1],[2,5]] },
  ]},

  // ── Level 29 — 10x10, 9 arrows ──
  { id: 29, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[3,6],[5,6]] },
    { id: 'b', points: [[3,9],[3,8],[7,8]] },
    { id: 'c', points: [[5,2],[3,2]] },
    { id: 'd', points: [[8,3],[8,7]] },
    { id: 'e', points: [[7,3],[7,7]] },
    { id: 'f', points: [[2,3],[2,0]] },
    { id: 'g', points: [[4,3],[6,3]] },
    { id: 'h', points: [[5,4],[3,4]] },
    { id: 'i', points: [[5,0],[5,1],[9,1]] },
  ]},

  // ── Level 30 — 10x10, 9 arrows ──
  { id: 30, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[7,8],[2,8]] },
    { id: 'b', points: [[1,6],[1,1]] },
    { id: 'c', points: [[3,3],[3,5]] },
    { id: 'd', points: [[6,4],[6,0]] },
    { id: 'e', points: [[2,3],[2,0]] },
    { id: 'f', points: [[7,5],[4,5]] },
    { id: 'g', points: [[8,4],[8,0]] },
    { id: 'h', points: [[4,1],[5,1],[5,3]] },
    { id: 'i', points: [[5,7],[1,7]] },
  ]},

  // ── Level 31 — 8x9, 8 arrows ──
  { id: 31, gridW: 8, gridH: 9, arrows: [
    { id: 'a', points: [[5,2],[5,5]] },
    { id: 'b', points: [[4,0],[4,1],[2,1]] },
    { id: 'c', points: [[3,6],[1,6]] },
    { id: 'd', points: [[6,7],[4,7]] },
    { id: 'e', points: [[3,3],[3,5]] },
    { id: 'f', points: [[4,2],[2,2]] },
    { id: 'g', points: [[1,1],[1,3]] },
    { id: 'h', points: [[6,6],[6,3]] },
  ]},

  // ── Level 32 — 9x10, 9 arrows ──
  { id: 32, gridW: 9, gridH: 10, arrows: [
    { id: 'a', points: [[6,4],[7,4],[7,7]] },
    { id: 'b', points: [[4,3],[4,5],[1,5]] },
    { id: 'c', points: [[4,6],[5,6],[5,3]] },
    { id: 'd', points: [[3,2],[7,2]] },
    { id: 'e', points: [[4,8],[2,8]] },
    { id: 'f', points: [[4,1],[1,1]] },
    { id: 'g', points: [[5,7],[3,7]] },
    { id: 'h', points: [[6,6],[6,8]] },
    { id: 'i', points: [[2,4],[2,2]] },
  ]},

  // ── Level 33 — 10x10, 10 arrows ──
  { id: 33, gridW: 10, gridH: 10, arrows: [
    { id: 'a', points: [[6,6],[8,6]] },
    { id: 'b', points: [[4,3],[5,3],[5,6]] },
    { id: 'c', points: [[3,3],[0,3]] },
    { id: 'd', points: [[2,1],[0,1]] },
    { id: 'e', points: [[7,5],[8,5],[8,2]] },
    { id: 'f', points: [[2,6],[3,6],[3,4]] },
    { id: 'g', points: [[7,2],[7,0]] },
    { id: 'h', points: [[6,2],[4,2]] },
    { id: 'i', points: [[5,9],[5,8],[2,8]] },
    { id: 'j', points: [[3,2],[3,0]] },
  ]},

  // ── Level 34 — 10x11, 11 arrows ──
  { id: 34, gridW: 10, gridH: 11, arrows: [
    { id: 'a', points: [[3,8],[0,8]] },
    { id: 'b', points: [[5,2],[7,2],[7,6]] },
    { id: 'c', points: [[7,10],[7,9],[9,9]] },
    { id: 'd', points: [[4,5],[0,5]] },
    { id: 'e', points: [[8,7],[8,2]] },
    { id: 'f', points: [[5,9],[5,7],[7,7]] },
    { id: 'g', points: [[4,1],[7,1]] },
    { id: 'h', points: [[4,3],[2,3]] },
    { id: 'i', points: [[6,8],[6,10]] },
    { id: 'j', points: [[1,2],[3,2]] },
    { id: 'k', points: [[6,5],[6,4],[1,4]] },
  ]},

  // ── Level 35 — 11x11, 12 arrows ──
  { id: 35, gridW: 11, gridH: 11, arrows: [
    { id: 'a', points: [[4,6],[2,6]] },
    { id: 'b', points: [[5,4],[5,8]] },
    { id: 'c', points: [[4,5],[4,2]] },
    { id: 'd', points: [[9,2],[9,3],[6,3]] },
    { id: 'e', points: [[6,8],[6,7],[9,7]] },
    { id: 'f', points: [[8,4],[6,4]] },
    { id: 'g', points: [[0,6],[1,6],[1,4]] },
    { id: 'h', points: [[9,5],[7,5]] },
    { id: 'i', points: [[9,1],[6,1]] },
    { id: 'j', points: [[4,8],[2,8]] },
    { id: 'k', points: [[9,6],[6,6]] },
    { id: 'l', points: [[2,9],[7,9]] },
  ]},

  // ── Level 36 [HARD] — 11x12, 14 arrows ──
  { id: 36, gridW: 11, gridH: 12, arrows: [
    { id: 'a01', points: [[1,1],[1,0]] },
    { id: 'a02', points: [[2,8],[0,8]] },
    { id: 'a03', points: [[3,2],[3,0]] },
    { id: 'a04', points: [[10,10],[8,10],[8,11]] },
    { id: 'a05', points: [[1,3],[2,3],[2,0]] },
    { id: 'a06', points: [[8,7],[8,9],[10,9]] },
    { id: 'a07', points: [[9,1],[9,0]] },
    { id: 'a08', points: [[1,9],[1,11]] },
    { id: 'a09', points: [[1,6],[0,6]] },
    { id: 'a10', points: [[7,10],[7,11]] },
    { id: 'a11', points: [[2,9],[2,11]] },
    { id: 'a12', points: [[6,10],[6,11]] },
    { id: 'a13', points: [[9,8],[10,8]] },
    { id: 'a14', points: [[9,5],[10,5]] },
  ]},

  // ── Level 37 — 10x11, 12 arrows ──
  { id: 37, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[7,9],[7,10]] },
    { id: 'a02', points: [[6,7],[9,7]] },
    { id: 'a03', points: [[8,3],[9,3]] },
    { id: 'a04', points: [[3,6],[0,6]] },
    { id: 'a05', points: [[6,9],[3,9],[3,10]] },
    { id: 'a06', points: [[8,8],[9,8]] },
    { id: 'a07', points: [[6,2],[9,2]] },
    { id: 'a08', points: [[3,2],[5,2],[5,0]] },
    { id: 'a09', points: [[2,1],[0,1]] },
    { id: 'a10', points: [[8,4],[9,4]] },
    { id: 'a11', points: [[8,5],[9,5]] },
    { id: 'a12', points: [[8,1],[7,1],[7,0]] },
  ]},

  // ── Level 38 — 10x11, 12 arrows ──
  { id: 38, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[1,2],[1,0]] },
    { id: 'a02', points: [[4,6],[0,6]] },
    { id: 'a03', points: [[1,8],[0,8]] },
    { id: 'a04', points: [[6,8],[9,8]] },
    { id: 'a05', points: [[1,3],[0,3]] },
    { id: 'a06', points: [[6,9],[6,10]] },
    { id: 'a07', points: [[6,2],[8,2],[8,0]] },
    { id: 'a08', points: [[7,5],[7,7],[9,7]] },
    { id: 'a09', points: [[2,2],[3,2],[3,0]] },
    { id: 'a10', points: [[1,4],[1,5],[0,5]] },
    { id: 'a11', points: [[4,9],[4,10]] },
    { id: 'a12', points: [[3,8],[3,9],[0,9]] },
  ]},

  // ── Level 39 — 10x11, 12 arrows ──
  { id: 39, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[7,2],[9,2]] },
    { id: 'a02', points: [[8,1],[9,1]] },
    { id: 'a03', points: [[7,8],[9,8]] },
    { id: 'a04', points: [[4,8],[0,8]] },
    { id: 'a05', points: [[7,4],[7,3],[9,3]] },
    { id: 'a06', points: [[2,3],[2,0]] },
    { id: 'a07', points: [[7,5],[9,5]] },
    { id: 'a08', points: [[3,1],[3,0]] },
    { id: 'a09', points: [[7,7],[9,7]] },
    { id: 'a10', points: [[1,9],[3,9],[3,10]] },
    { id: 'a11', points: [[1,6],[1,7],[0,7]] },
    { id: 'a12', points: [[6,3],[6,0]] },
  ]},

  // ── Level 40 [HARD] — 11x12, 14 arrows ──
  { id: 40, gridW: 11, gridH: 12, arrows: [
    { id: 'a01', points: [[9,3],[10,3]] },
    { id: 'a02', points: [[7,1],[10,1]] },
    { id: 'a03', points: [[4,10],[7,10],[7,11]] },
    { id: 'a04', points: [[1,10],[1,7],[0,7]] },
    { id: 'a05', points: [[1,1],[1,0]] },
    { id: 'a06', points: [[9,7],[10,7]] },
    { id: 'a07', points: [[6,1],[5,1],[5,0]] },
    { id: 'a08', points: [[9,4],[10,4]] },
    { id: 'a09', points: [[3,3],[3,0]] },
    { id: 'a10', points: [[2,1],[2,0]] },
    { id: 'a11', points: [[1,4],[0,4]] },
    { id: 'a12', points: [[7,5],[10,5]] },
    { id: 'a13', points: [[2,10],[2,11]] },
    { id: 'a14', points: [[9,9],[9,10],[10,10]] },
  ]},

  // ── Level 41 — 10x11, 12 arrows ──
  { id: 41, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[1,9],[0,9]] },
    { id: 'a02', points: [[1,1],[1,0]] },
    { id: 'a03', points: [[4,1],[4,0]] },
    { id: 'a04', points: [[1,3],[0,3]] },
    { id: 'a05', points: [[5,2],[5,0]] },
    { id: 'a06', points: [[8,5],[8,3],[9,3]] },
    { id: 'a07', points: [[3,7],[0,7]] },
    { id: 'a08', points: [[8,2],[8,0]] },
    { id: 'a09', points: [[6,8],[5,8],[5,10]] },
    { id: 'a10', points: [[1,8],[2,8],[2,10]] },
    { id: 'a11', points: [[2,1],[2,0]] },
    { id: 'a12', points: [[7,4],[7,0]] },
  ]},

  // ── Level 42 — 10x11, 12 arrows ──
  { id: 42, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[8,4],[8,3],[9,3]] },
    { id: 'a02', points: [[7,2],[9,2]] },
    { id: 'a03', points: [[1,2],[1,0]] },
    { id: 'a04', points: [[6,5],[9,5]] },
    { id: 'a05', points: [[4,7],[4,10]] },
    { id: 'a06', points: [[1,9],[1,10]] },
    { id: 'a07', points: [[8,7],[9,7]] },
    { id: 'a08', points: [[3,8],[3,10]] },
    { id: 'a09', points: [[4,3],[3,3],[3,0]] },
    { id: 'a10', points: [[2,9],[2,10]] },
    { id: 'a11', points: [[7,9],[6,9],[6,10]] },
    { id: 'a12', points: [[8,1],[8,0]] },
  ]},

  // ── Level 43 — 10x11, 12 arrows ──
  { id: 43, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[2,9],[2,10]] },
    { id: 'a02', points: [[3,8],[3,10]] },
    { id: 'a03', points: [[1,2],[1,0]] },
    { id: 'a04', points: [[7,1],[7,2],[9,2]] },
    { id: 'a05', points: [[5,7],[5,10]] },
    { id: 'a06', points: [[3,5],[0,5]] },
    { id: 'a07', points: [[6,1],[6,0]] },
    { id: 'a08', points: [[5,1],[5,0]] },
    { id: 'a09', points: [[7,9],[6,9],[6,10]] },
    { id: 'a10', points: [[2,3],[0,3]] },
    { id: 'a11', points: [[3,2],[3,0]] },
    { id: 'a12', points: [[1,9],[1,8],[0,8]] },
  ]},

  // ── Level 44 — 10x11, 12 arrows ──
  { id: 44, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[8,9],[9,9]] },
    { id: 'a02', points: [[1,7],[1,10]] },
    { id: 'a03', points: [[8,2],[9,2]] },
    { id: 'a04', points: [[1,1],[0,1]] },
    { id: 'a05', points: [[2,2],[0,2]] },
    { id: 'a06', points: [[7,8],[7,10]] },
    { id: 'a07', points: [[4,6],[0,6]] },
    { id: 'a08', points: [[4,2],[4,0]] },
    { id: 'a09', points: [[5,3],[5,0]] },
    { id: 'a10', points: [[7,1],[7,0]] },
    { id: 'a11', points: [[3,2],[3,3],[0,3]] },
    { id: 'a12', points: [[3,9],[3,10]] },
  ]},

  // ── Level 45 — 10x11, 12 arrows ──
  { id: 45, gridW: 10, gridH: 11, arrows: [
    { id: 'a01', points: [[6,1],[3,1],[3,0]] },
    { id: 'a02', points: [[8,6],[8,5],[9,5]] },
    { id: 'a03', points: [[7,5],[7,7],[9,7]] },
    { id: 'a04', points: [[7,2],[9,2]] },
    { id: 'a05', points: [[2,6],[2,10]] },
    { id: 'a06', points: [[2,4],[0,4]] },
    { id: 'a07', points: [[1,3],[0,3]] },
    { id: 'a08', points: [[8,1],[8,0]] },
    { id: 'a09', points: [[6,9],[6,10]] },
    { id: 'a10', points: [[1,2],[1,0]] },
    { id: 'a11', points: [[6,4],[9,4]] },
    { id: 'a12', points: [[8,8],[8,10]] },
  ]},

  // ── Level 46 [HARD] — 12x12, 15 arrows ──
  { id: 46, gridW: 12, gridH: 12, arrows: [
    { id: 'a01', points: [[10,2],[10,0]] },
    { id: 'a02', points: [[10,6],[10,9],[11,9]] },
    { id: 'a03', points: [[10,3],[11,3]] },
    { id: 'a04', points: [[3,8],[3,11]] },
    { id: 'a05', points: [[1,8],[1,11]] },
    { id: 'a06', points: [[8,3],[7,3],[7,0]] },
    { id: 'a07', points: [[9,1],[9,0]] },
    { id: 'a08', points: [[4,9],[4,11]] },
    { id: 'a09', points: [[3,4],[0,4]] },
    { id: 'a10', points: [[3,1],[0,1]] },
    { id: 'a11', points: [[2,10],[2,11]] },
    { id: 'a12', points: [[9,8],[9,11]] },
    { id: 'a13', points: [[1,7],[0,7]] },
    { id: 'a14', points: [[6,3],[6,0]] },
    { id: 'a15', points: [[3,3],[0,3]] },
  ]},

  // ── Level 47 — 11x11, 12 arrows ──
  { id: 47, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[8,4],[8,2],[10,2]] },
    { id: 'a02', points: [[8,0],[8,1],[10,1]] },
    { id: 'a03', points: [[2,9],[2,10]] },
    { id: 'a04', points: [[6,1],[6,0]] },
    { id: 'a05', points: [[8,8],[10,8]] },
    { id: 'a06', points: [[2,3],[2,2],[0,2]] },
    { id: 'a07', points: [[2,1],[2,0]] },
    { id: 'a08', points: [[1,6],[0,6]] },
    { id: 'a09', points: [[4,8],[4,10]] },
    { id: 'a10', points: [[7,9],[10,9]] },
    { id: 'a11', points: [[4,3],[4,0]] },
    { id: 'a12', points: [[7,1],[7,0]] },
  ]},

  // ── Level 48 — 11x11, 12 arrows ──
  { id: 48, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[8,8],[10,8]] },
    { id: 'a02', points: [[1,3],[0,3]] },
    { id: 'a03', points: [[2,8],[0,8]] },
    { id: 'a04', points: [[9,1],[9,0]] },
    { id: 'a05', points: [[7,9],[7,10]] },
    { id: 'a06', points: [[9,9],[9,10]] },
    { id: 'a07', points: [[6,3],[6,0]] },
    { id: 'a08', points: [[9,7],[10,7]] },
    { id: 'a09', points: [[3,6],[3,10]] },
    { id: 'a10', points: [[9,6],[10,6]] },
    { id: 'a11', points: [[4,5],[0,5]] },
    { id: 'a12', points: [[7,1],[7,0]] },
  ]},

  // ── Level 49 — 11x11, 12 arrows ──
  { id: 49, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[5,9],[5,10]] },
    { id: 'a02', points: [[9,9],[9,10]] },
    { id: 'a03', points: [[9,8],[9,5],[10,5]] },
    { id: 'a04', points: [[2,1],[2,0]] },
    { id: 'a05', points: [[9,3],[9,2],[10,2]] },
    { id: 'a06', points: [[7,3],[7,0]] },
    { id: 'a07', points: [[5,1],[5,0]] },
    { id: 'a08', points: [[1,6],[1,10]] },
    { id: 'a09', points: [[1,3],[0,3]] },
    { id: 'a10', points: [[3,3],[3,0]] },
    { id: 'a11', points: [[8,4],[8,0]] },
    { id: 'a12', points: [[4,8],[4,10]] },
  ]},

  // ── Level 50 [HARD] — 12x12, 15 arrows ──
  { id: 50, gridW: 12, gridH: 12, arrows: [
    { id: 'a01', points: [[8,7],[8,11]] },
    { id: 'a02', points: [[2,9],[0,9]] },
    { id: 'a03', points: [[2,2],[0,2]] },
    { id: 'a04', points: [[5,9],[5,11]] },
    { id: 'a05', points: [[1,4],[0,4]] },
    { id: 'a06', points: [[10,3],[10,0]] },
    { id: 'a07', points: [[6,10],[7,10],[7,11]] },
    { id: 'a08', points: [[10,9],[11,9]] },
    { id: 'a09', points: [[1,1],[0,1]] },
    { id: 'a10', points: [[5,3],[5,0]] },
    { id: 'a11', points: [[9,1],[9,0]] },
    { id: 'a12', points: [[11,10],[10,10],[10,11]] },
    { id: 'a13', points: [[4,1],[4,0]] },
    { id: 'a14', points: [[8,2],[8,0]] },
    { id: 'a15', points: [[9,6],[11,6]] },
  ]},

  // ── Level 51 — 11x11, 12 arrows ──
  { id: 51, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[0,9],[1,9],[1,10]] },
    { id: 'a02', points: [[8,2],[10,2]] },
    { id: 'a03', points: [[2,6],[0,6]] },
    { id: 'a04', points: [[2,5],[0,5]] },
    { id: 'a05', points: [[5,8],[7,8],[7,10]] },
    { id: 'a06', points: [[4,8],[0,8]] },
    { id: 'a07', points: [[4,9],[4,10]] },
    { id: 'a08', points: [[6,1],[9,1],[9,0]] },
    { id: 'a09', points: [[9,8],[9,7],[10,7]] },
    { id: 'a10', points: [[8,6],[8,10]] },
    { id: 'a11', points: [[9,9],[9,10]] },
    { id: 'a12', points: [[7,5],[10,5]] },
  ]},

  // ── Level 52 — 11x11, 12 arrows ──
  { id: 52, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[7,9],[7,10]] },
    { id: 'a02', points: [[7,1],[10,1]] },
    { id: 'a03', points: [[8,8],[6,8],[6,10]] },
    { id: 'a04', points: [[2,5],[0,5]] },
    { id: 'a05', points: [[5,9],[4,9],[4,10]] },
    { id: 'a06', points: [[3,1],[0,1]] },
    { id: 'a07', points: [[1,6],[0,6]] },
    { id: 'a08', points: [[4,2],[4,0]] },
    { id: 'a09', points: [[2,9],[0,9]] },
    { id: 'a10', points: [[9,4],[9,3],[10,3]] },
    { id: 'a11', points: [[7,3],[7,2],[10,2]] },
    { id: 'a12', points: [[5,3],[6,3],[6,0]] },
  ]},

  // ── Level 53 — 11x11, 12 arrows ──
  { id: 53, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[5,9],[5,10]] },
    { id: 'a02', points: [[3,2],[0,2]] },
    { id: 'a03', points: [[1,1],[1,0]] },
    { id: 'a04', points: [[1,6],[0,6]] },
    { id: 'a05', points: [[8,9],[6,9],[6,10]] },
    { id: 'a06', points: [[1,9],[1,10]] },
    { id: 'a07', points: [[6,1],[6,0]] },
    { id: 'a08', points: [[8,4],[8,0]] },
    { id: 'a09', points: [[5,1],[5,0]] },
    { id: 'a10', points: [[7,5],[10,5]] },
    { id: 'a11', points: [[2,1],[4,1],[4,0]] },
    { id: 'a12', points: [[3,3],[3,4],[0,4]] },
  ]},

  // ── Level 54 — 11x11, 12 arrows ──
  { id: 54, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[4,8],[0,8]] },
    { id: 'a02', points: [[2,1],[2,0]] },
    { id: 'a03', points: [[4,3],[5,3],[5,0]] },
    { id: 'a04', points: [[3,4],[0,4]] },
    { id: 'a05', points: [[4,5],[0,5]] },
    { id: 'a06', points: [[7,3],[7,0]] },
    { id: 'a07', points: [[7,9],[7,10]] },
    { id: 'a08', points: [[8,9],[8,10]] },
    { id: 'a09', points: [[8,5],[8,6],[10,6]] },
    { id: 'a10', points: [[9,3],[10,3]] },
    { id: 'a11', points: [[6,3],[6,0]] },
    { id: 'a12', points: [[9,4],[10,4]] },
  ]},

  // ── Level 55 — 11x11, 12 arrows ──
  { id: 55, gridW: 11, gridH: 11, arrows: [
    { id: 'a01', points: [[1,5],[1,8],[0,8]] },
    { id: 'a02', points: [[5,3],[5,0]] },
    { id: 'a03', points: [[6,9],[10,9]] },
    { id: 'a04', points: [[4,4],[4,0]] },
    { id: 'a05', points: [[7,4],[7,0]] },
    { id: 'a06', points: [[1,3],[1,0]] },
    { id: 'a07', points: [[9,1],[10,1]] },
    { id: 'a08', points: [[8,3],[10,3]] },
    { id: 'a09', points: [[8,4],[10,4]] },
    { id: 'a10', points: [[3,1],[3,0]] },
    { id: 'a11', points: [[3,10],[3,9],[0,9]] },
    { id: 'a12', points: [[5,9],[5,10]] },
  ]},

  // ── Level 56 [HARD] — 13x13, 16 arrows ──
  { id: 56, gridW: 13, gridH: 13, arrows: [
    { id: 'a01', points: [[10,11],[10,12]] },
    { id: 'a02', points: [[3,5],[0,5]] },
    { id: 'a03', points: [[11,10],[12,10]] },
    { id: 'a04', points: [[11,2],[11,1],[12,1]] },
    { id: 'a05', points: [[9,9],[9,12]] },
    { id: 'a06', points: [[9,8],[12,8]] },
    { id: 'a07', points: [[1,7],[1,8],[0,8]] },
    { id: 'a08', points: [[3,10],[0,10]] },
    { id: 'a09', points: [[7,8],[7,12]] },
    { id: 'a10', points: [[8,4],[12,4]] },
    { id: 'a11', points: [[3,3],[2,3],[2,0]] },
    { id: 'a12', points: [[6,10],[4,10],[4,12]] },
    { id: 'a13', points: [[8,9],[8,12]] },
    { id: 'a14', points: [[10,2],[8,2],[8,0]] },
    { id: 'a15', points: [[8,3],[12,3]] },
    { id: 'a16', points: [[1,2],[0,2]] },
  ]},

  // ── Level 57 — 11x12, 13 arrows ──
  { id: 57, gridW: 11, gridH: 12, arrows: [
    { id: 'a01', points: [[8,9],[8,11]] },
    { id: 'a02', points: [[5,10],[5,11]] },
    { id: 'a03', points: [[6,3],[7,3],[7,0]] },
    { id: 'a04', points: [[1,1],[0,1]] },
    { id: 'a05', points: [[9,5],[9,8],[10,8]] },
    { id: 'a06', points: [[1,9],[0,9]] },
    { id: 'a07', points: [[7,4],[10,4]] },
    { id: 'a08', points: [[2,8],[2,11]] },
    { id: 'a09', points: [[4,2],[4,0]] },
    { id: 'a10', points: [[9,3],[9,0]] },
    { id: 'a11', points: [[1,10],[1,11]] },
    { id: 'a12', points: [[8,1],[8,0]] },
    { id: 'a13', points: [[7,8],[7,11]] },
  ]},

  // ── Level 58 — 11x12, 13 arrows ──
  { id: 58, gridW: 11, gridH: 12, arrows: [
    { id: 'a01', points: [[3,9],[3,8],[0,8]] },
    { id: 'a02', points: [[2,10],[1,10],[1,11]] },
    { id: 'a03', points: [[6,9],[6,11]] },
    { id: 'a04', points: [[6,4],[6,0]] },
    { id: 'a05', points: [[7,10],[10,10]] },
    { id: 'a06', points: [[4,9],[4,11]] },
    { id: 'a07', points: [[9,5],[10,5]] },
    { id: 'a08', points: [[4,3],[0,3]] },
    { id: 'a09', points: [[9,4],[9,0]] },
    { id: 'a10', points: [[4,1],[4,0]] },
    { id: 'a11', points: [[1,9],[0,9]] },
    { id: 'a12', points: [[5,7],[5,11]] },
    { id: 'a13', points: [[9,8],[10,8]] },
  ]},

  // ── Level 59 — 11x12, 13 arrows ──
  { id: 59, gridW: 11, gridH: 12, arrows: [
    { id: 'a01', points: [[1,4],[0,4]] },
    { id: 'a02', points: [[2,8],[2,11]] },
    { id: 'a03', points: [[8,2],[8,4],[10,4]] },
    { id: 'a04', points: [[9,10],[10,10]] },
    { id: 'a05', points: [[7,9],[5,9],[5,11]] },
    { id: 'a06', points: [[4,1],[4,0]] },
    { id: 'a07', points: [[2,6],[2,7],[0,7]] },
    { id: 'a08', points: [[9,1],[9,0]] },
    { id: 'a09', points: [[1,8],[0,8]] },
    { id: 'a10', points: [[7,1],[7,0]] },
    { id: 'a11', points: [[7,6],[10,6]] },
    { id: 'a12', points: [[2,3],[0,3]] },
    { id: 'a13', points: [[3,9],[3,11]] },
  ]},

  // ── Level 60 [HARD] — 13x13, 16 arrows ──
  { id: 60, gridW: 13, gridH: 13, arrows: [
    { id: 'a01', points: [[1,9],[0,9]] },
    { id: 'a02', points: [[9,10],[10,10],[10,12]] },
    { id: 'a03', points: [[3,11],[3,12]] },
    { id: 'a04', points: [[5,10],[4,10],[4,12]] },
    { id: 'a05', points: [[4,2],[0,2]] },
    { id: 'a06', points: [[2,7],[2,6],[0,6]] },
    { id: 'a07', points: [[5,11],[5,12]] },
    { id: 'a08', points: [[8,10],[8,12]] },
    { id: 'a09', points: [[9,3],[12,3]] },
    { id: 'a10', points: [[2,10],[0,10]] },
    { id: 'a11', points: [[4,4],[0,4]] },
    { id: 'a12', points: [[4,8],[0,8]] },
    { id: 'a13', points: [[9,1],[12,1]] },
    { id: 'a14', points: [[8,4],[8,0]] },
    { id: 'a15', points: [[0,11],[1,11],[1,12]] },
    { id: 'a16', points: [[11,7],[12,7]] },
  ]},
];
