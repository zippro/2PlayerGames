'use client';

import { sounds, vibrate } from '@/lib/sounds';
import { useState, useCallback, useRef, useEffect } from 'react';

const GRID_SIZE = 10;
const SHIPS = [
  { name: 'Carrier', size: 5, symbol: 'CA' },
  { name: 'Battleship', size: 4, symbol: 'BB' },
  { name: 'Cruiser', size: 3, symbol: 'CR' },
  { name: 'Submarine', size: 3, symbol: 'SB' },
  { name: 'Destroyer', size: 2, symbol: 'DD' },
];

function createEmptyGrid() {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
  // 0 = empty, 1 = ship, 2 = hit, 3 = miss
}

function canPlaceShip(grid, row, col, size, horizontal) {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r >= GRID_SIZE || c >= GRID_SIZE || grid[r][c] !== 0) return false;
  }
  return true;
}

function placeShipOnGrid(grid, row, col, size, horizontal) {
  const newGrid = grid.map(r => [...r]);
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    newGrid[r][c] = 1;
  }
  return newGrid;
}

function autoPlaceShips() {
  let grid = createEmptyGrid();
  for (const ship of SHIPS) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      const h = Math.random() > 0.5;
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      if (canPlaceShip(grid, r, c, ship.size, h)) {
        grid = placeShipOnGrid(grid, r, c, ship.size, h);
        placed = true;
      }
      attempts++;
    }
  }
  return grid;
}

function countHits(grid) {
  let hits = 0;
  for (const row of grid) for (const cell of row) if (cell === 2) hits++;
  return hits;
}

function countShipCells(grid) {
  let count = 0;
  for (const row of grid) for (const cell of row) if (cell === 1 || cell === 2) count++;
  return count;
}

const totalShipCells = SHIPS.reduce((sum, s) => sum + s.size, 0);

function Cell({ value, onClick, showShips, isEnemy }) {
  let bg = 'rgba(255,255,255,0.06)';
  let content = '';
  
  if (value === 1 && showShips) { bg = 'rgba(78, 205, 196, 0.35)'; content = ''; }
  if (value === 2) { bg = 'rgba(255, 107, 107, 0.6)'; content = '💥'; }
  if (value === 3) { bg = 'rgba(255,255,255,0.12)'; content = '•'; }

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        aspectRatio: '1',
        background: bg,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3,
        cursor: isEnemy && value < 2 ? 'crosshair' : 'default',
        fontSize: 'min(3.5vw, 14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 0.2s',
        color: '#fff',
      }}
    >
      {content}
    </button>
  );
}

export default function SeaBattle({ mode, difficulty, onGameEnd }) {
  const [phase, setPhase] = useState('setup'); // setup, battle
  const [p1Grid, setP1Grid] = useState(autoPlaceShips);
  const [p2Grid, setP2Grid] = useState(autoPlaceShips);
  const [p1Attacks, setP1Attacks] = useState(createEmptyGrid);
  const [p2Attacks, setP2Attacks] = useState(createEmptyGrid);
  const [turn, setTurn] = useState(1);
  const [message, setMessage] = useState('Tap on enemy grid to fire!');
  const startTimeRef = useRef(Date.now());

  // Auto-place ships and start battle immediately
  useEffect(() => {
    setPhase('battle');
  }, []);

  // Bot hunting state
  const botStateRef = useRef({ mode: 'hunt', targets: [], lastHit: null });

  const fire = useCallback((row, col, attacker) => {
    if (attacker === 1) {
      // P1 attacking P2's grid
      const newAttacks = p1Attacks.map(r => [...r]);
      if (newAttacks[row][col] >= 2) return false; // Already attacked
      
      const hit = p2Grid[row][col] === 1;
      newAttacks[row][col] = hit ? 2 : 3;
      setP1Attacks(newAttacks);
      
      // Check win
      const hitCount = countHits(newAttacks) + (hit ? 0 : 0);
      let totalHits = 0;
      for (const r of newAttacks) for (const c of r) if (c === 2) totalHits++;
      if (hit) totalHits++;
      
      // Recount properly
      const updatedAttacks = newAttacks;
      let p1HitCount = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (updatedAttacks[r][c] === 2 && p2Grid[r][c] === 1) p1HitCount++;
        }
      }
      
      if (p1HitCount >= totalShipCells) {
        setMessage('Player 1 wins! All ships sunk!');
        setTimeout(() => onGameEnd(1, Math.round((Date.now() - startTimeRef.current) / 1000)), 600);
        return true;
      }
      
      setMessage(hit ? '💥 Hit!' : '💨 Miss!');
      return hit;
    } else {
      // P2 attacking P1's grid
      const newAttacks = p2Attacks.map(r => [...r]);
      if (newAttacks[row][col] >= 2) return false;
      
      const hit = p1Grid[row][col] === 1;
      newAttacks[row][col] = hit ? 2 : 3;
      setP2Attacks(newAttacks);
      
      let p2HitCount = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (newAttacks[r][c] === 2 && p1Grid[r][c] === 1) p2HitCount++;
        }
      }
      
      if (p2HitCount >= totalShipCells) {
        const winner = mode === '1p' ? 'bot' : 2;
        setMessage(mode === '1p' ? 'Bot wins!' : 'Player 2 wins!');
        setTimeout(() => onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000)), 600);
        return true;
      }
      
      setMessage(hit ? '💥 Bot Hit!' : '💨 Bot Miss!');
      return hit;
    }
  }, [p1Attacks, p2Attacks, p1Grid, p2Grid, mode, onGameEnd]);

  const handleP1Attack = useCallback((row, col) => {
    if (turn !== 1 || phase !== 'battle') return;
    if (p1Attacks[row][col] >= 2) return;
    
    fire(row, col, 1);
    setTurn(2);
  }, [turn, phase, p1Attacks, fire]);

  // Bot move
  useEffect(() => {
    if (turn !== 2 || mode !== '1p' || phase !== 'battle') return;

    const timer = setTimeout(() => {
      const state = botStateRef.current;
      const diffId = difficulty?.id || 'normal';
      let row, col;

      // Find untried cells
      const untried = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (p2Attacks[r][c] < 2) untried.push([r, c]);
        }
      }

      if (untried.length === 0) return;

      if (diffId === 'hard' && Math.random() < 0.3) {
        // Cheat: find a ship cell
        const shipCells = untried.filter(([r, c]) => p1Grid[r][c] === 1);
        if (shipCells.length > 0) {
          [row, col] = shipCells[Math.floor(Math.random() * shipCells.length)];
        }
      }

      if (row === undefined) {
        if (state.targets.length > 0) {
          [row, col] = state.targets.shift();
          while (row !== undefined && p2Attacks[row][col] >= 2) {
            const next = state.targets.shift();
            if (!next) { row = undefined; break; }
            [row, col] = next;
          }
        }
        
        if (row === undefined) {
          // Checkerboard pattern for smarter hunting
          const checkerboard = untried.filter(([r, c]) => (r + c) % 2 === 0);
          const pool = checkerboard.length > 0 ? checkerboard : untried;
          [row, col] = pool[Math.floor(Math.random() * pool.length)];
        }
      }

      const hit = p1Grid[row][col] === 1;
      fire(row, col, 2);

      if (hit) {
        // Add adjacent cells as targets
        const adj = [[row-1,col],[row+1,col],[row,col-1],[row,col+1]];
        for (const [r, c] of adj) {
          if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && p2Attacks[r][c] < 2) {
            state.targets.push([r, c]);
          }
        }
      }

      setTurn(1);
    }, 600 + Math.random() * 500);

    return () => clearTimeout(timer);
  }, [turn, mode, phase, p2Attacks, p1Grid, difficulty, fire]);

  // P2 human turn
  const handleP2Attack = useCallback((row, col) => {
    if (turn !== 2 || mode !== '2p' || phase !== 'battle') return;
    if (p2Attacks[row][col] >= 2) return;
    
    fire(row, col, 2);
    setTurn(1);
  }, [turn, mode, phase, p2Attacks, fire]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0d1117',
      padding: '8px',
      gap: 4,
    }}>
      {/* Status */}
      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        padding: '4px 0',
        color: turn === 1 ? 'var(--p1-color)' : 'var(--p2-color)',
      }}>
        {message} • {turn === 1 ? (mode === '1p' ? 'Your' : 'P1') : (mode === '1p' ? 'Bot' : 'P2')} Turn
      </div>

      {/* P2's grid (enemy for P1) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, color: 'var(--p2-color)', fontWeight: 700, marginBottom: 2, textAlign: 'center' }}>
          {mode === '1p' ? '🤖 BOT WATERS' : '🔵 PLAYER 2'}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 2,
          flex: 1,
        }}>
          {Array(GRID_SIZE).fill(null).map((_, r) =>
            Array(GRID_SIZE).fill(null).map((_, c) => (
              <Cell
                key={`e-${r}-${c}`}
                value={p1Attacks[r][c] >= 2 ? p1Attacks[r][c] : (p2Grid[r][c] === 1 && p1Attacks[r][c] === 2 ? 2 : p1Attacks[r][c])}
                onClick={() => handleP1Attack(r, c)}
                showShips={false}
                isEnemy={turn === 1}
              />
            ))
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

      {/* P1's grid (own) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, color: 'var(--p1-color)', fontWeight: 700, marginBottom: 2, textAlign: 'center' }}>
          {mode === '1p' ? '🟡 YOUR WATERS' : '🔴 PLAYER 1'}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 2,
          flex: 1,
        }}>
          {Array(GRID_SIZE).fill(null).map((_, r) =>
            Array(GRID_SIZE).fill(null).map((_, c) => {
              const atkVal = p2Attacks[r][c];
              const shipVal = p1Grid[r][c];
              let displayVal = 0;
              if (atkVal === 2) displayVal = 2;
              else if (atkVal === 3) displayVal = 3;
              else if (shipVal === 1) displayVal = 1;
              return (
                <Cell
                  key={`m-${r}-${c}`}
                  value={displayVal}
                  onClick={mode === '2p' ? () => handleP2Attack(r, c) : undefined}
                  showShips={true}
                  isEnemy={false}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
