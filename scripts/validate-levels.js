/**
 * Arrow Puzzle Level Validator
 * 
 * Checks every level for:
 * 1. Solvability — can all arrows be removed in some order?
 * 2. Overlap — do any arrows' body cells overlap with each other?
 * 3. Out-of-bounds — are all arrow cells within the grid?
 * 4. Body sweep — when an arrow escapes, does its body sweep through other arrows?
 */

// Import level data and helpers directly
const fs = require('fs');
const path = require('path');

// Read and eval the arrowLevels module
const src = fs.readFileSync(path.join(__dirname, '../lib/arrowLevels.js'), 'utf8');

// We need to extract the functions manually since it's ESM
// Re-implement the core functions here for the validator

function getArrowCells(arrow) {
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

function getEscapeDir(arrow) {
  const pts = arrow.points;
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return {
    dx: Math.sign(last[0] - prev[0]),
    dy: Math.sign(last[1] - prev[1]),
  };
}

function canArrowEscape(arrow, allArrows, gridW, gridH) {
  const otherCells = new Set();
  for (const a of allArrows) {
    if (a.id !== arrow.id) {
      for (const c of getArrowCells(a)) otherCells.add(c);
    }
  }
  const ownCells = getArrowCells(arrow);
  const { dx, dy } = getEscapeDir(arrow);

  for (const cellKey of ownCells) {
    const [cx, cy] = cellKey.split(',').map(Number);
    let sx = cx + dx;
    let sy = cy + dy;
    while (sx >= 0 && sy >= 0 && sx < gridW && sy < gridH) {
      if (!ownCells.has(`${sx},${sy}`) && otherCells.has(`${sx},${sy}`)) {
        return false;
      }
      sx += dx;
      sy += dy;
    }
  }
  return true;
}

function solve(arrows, gridW, gridH, _deadline) {
  if (arrows.length === 0) return [];
  const deadline = _deadline || Date.now() + 5000; // 5s for validation (generous)
  for (const arrow of arrows) {
    if (Date.now() > deadline) return null;
    if (canArrowEscape(arrow, arrows, gridW, gridH)) {
      const rest = arrows.filter(a => a.id !== arrow.id);
      const sub = solve(rest, gridW, gridH, deadline);
      if (sub !== null) return [arrow, ...sub];
    }
  }
  return null;
}

// Parse LEVELS from the source file
// Extract the LEVELS array using regex
const levelsMatch = src.match(/export const LEVELS\s*=\s*\[([\s\S]*)\];?\s*$/m);
if (!levelsMatch) {
  console.error('Could not find LEVELS export in arrowLevels.js');
  process.exit(1);
}

// Use a safer approach: require via a temp file that converts ESM to CJS
const tmpFile = path.join(__dirname, '_tmp_levels.cjs');
const cjsSrc = src
  .replace(/^export /gm, '')
  .replace(/^import .*/gm, '');
fs.writeFileSync(tmpFile, cjsSrc + '\nmodule.exports = { LEVELS };');
const { LEVELS } = require(tmpFile);
fs.unlinkSync(tmpFile);

console.log(`\n🔍 Validating ${LEVELS.length} levels...\n`);
console.log('─'.repeat(70));

let totalIssues = 0;

for (const level of LEVELS) {
  const issues = [];
  const arrows = level.arrows.map(a => ({ ...a, points: a.points.map(p => [...p]) }));
  
  // Check 1: Out of bounds
  for (const arrow of arrows) {
    const cells = getArrowCells(arrow);
    for (const cellKey of cells) {
      const [x, y] = cellKey.split(',').map(Number);
      if (x < 0 || y < 0 || x >= level.gridW || y >= level.gridH) {
        issues.push(`  ❌ Arrow "${arrow.id}" has cell (${x},${y}) OUT OF BOUNDS (grid: ${level.gridW}×${level.gridH})`);
      }
    }
  }

  // Check 2: Overlapping cells between different arrows
  const cellOwner = new Map(); // "x,y" -> arrow.id
  for (const arrow of arrows) {
    const cells = getArrowCells(arrow);
    for (const cellKey of cells) {
      if (cellOwner.has(cellKey)) {
        issues.push(`  ❌ OVERLAP: Cell ${cellKey} is shared by "${cellOwner.get(cellKey)}" and "${arrow.id}"`);
      } else {
        cellOwner.set(cellKey, arrow.id);
      }
    }
  }

  // Check 3: Solvability
  const solution = solve(arrows, level.gridW, level.gridH);
  if (solution === null) {
    issues.push(`  ❌ UNSOLVABLE: No solution found (solver timed out or stuck)`);
  } else {
    // Check 4: Verify the solution order — each step must have a clear sweep path
    const remaining = [...arrows];
    for (let step = 0; step < solution.length; step++) {
      const arrowToRemove = solution[step];
      const arrowInRemaining = remaining.find(a => a.id === arrowToRemove.id);
      if (!arrowInRemaining) {
        issues.push(`  ❌ SOLVER BUG: Arrow "${arrowToRemove.id}" not found in remaining set at step ${step + 1}`);
        break;
      }

      // Verify full-body sweep is clear
      if (!canArrowEscape(arrowInRemaining, remaining, level.gridW, level.gridH)) {
        issues.push(`  ❌ SWEEP VIOLATION at step ${step + 1}: Arrow "${arrowToRemove.id}" body would pass through another arrow`);
      }

      // Remove this arrow
      const idx = remaining.findIndex(a => a.id === arrowToRemove.id);
      remaining.splice(idx, 1);
    }

    if (remaining.length > 0) {
      issues.push(`  ❌ INCOMPLETE: ${remaining.length} arrows left after solution: ${remaining.map(a => a.id).join(', ')}`);
    }
  }

  // Report
  const status = issues.length === 0 ? '✅' : '❌';
  const arrowCount = arrows.length;
  const solvable = solution !== null ? `solvable (${solution.length} steps)` : 'STUCK/TIMEOUT';
  
  console.log(`${status} Level ${String(level.id).padStart(2)} | ${level.gridW}×${level.gridH} | ${arrowCount} arrows | ${solvable}`);
  
  if (issues.length > 0) {
    issues.forEach(i => console.log(i));
    totalIssues += issues.length;
  }
}

console.log('─'.repeat(70));
if (totalIssues === 0) {
  console.log(`\n✅ All ${LEVELS.length} levels passed validation!\n`);
} else {
  console.log(`\n❌ Found ${totalIssues} issue(s) across levels.\n`);
}
