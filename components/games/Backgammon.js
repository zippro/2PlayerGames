'use client';

import { sounds, vibrate } from '@/lib/sounds';
import { useState, useCallback, useEffect, useRef } from 'react';

// Simplified Backgammon
const TOTAL_POINTS = 24;
const PIECES_PER_PLAYER = 15;

// Initial setup: [pointIndex, count] for each player
// Points 0-23 (P1 moves from high to low, P2 from low to high)
const INITIAL_P1 = [[23, 2], [12, 5], [7, 3], [5, 5]]; // 15 total
const INITIAL_P2 = [[0, 2], [11, 5], [16, 3], [18, 5]]; // 15 total

function createBoard() {
  const points = Array(TOTAL_POINTS).fill(null).map(() => ({ p1: 0, p2: 0 }));
  for (const [i, n] of INITIAL_P1) points[i].p1 = n;
  for (const [i, n] of INITIAL_P2) points[i].p2 = n;
  return points;
}

function rollDice() {
  return [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)];
}

function getValidMoves(points, player, dice, barP1, barP2) {
  const moves = [];
  const bar = player === 1 ? barP1 : barP2;
  
  for (const d of dice) {
    if (bar > 0) {
      // Must move from bar first
      const target = player === 1 ? TOTAL_POINTS - d : d - 1;
      if (target >= 0 && target < TOTAL_POINTS) {
        const opp = player === 1 ? points[target].p2 : points[target].p1;
        if (opp <= 1) {
          moves.push({ from: 'bar', to: target, die: d });
        }
      }
    } else {
      for (let i = 0; i < TOTAL_POINTS; i++) {
        const count = player === 1 ? points[i].p1 : points[i].p2;
        if (count <= 0) continue;

        const target = player === 1 ? i - d : i + d;
        
        // Bearing off
        if ((player === 1 && target < 0) || (player === 2 && target >= TOTAL_POINTS)) {
          // Check if all pieces are in home board
          let allHome = true;
          if (player === 1) {
            for (let j = 6; j < TOTAL_POINTS; j++) if (points[j].p1 > 0) allHome = false;
          } else {
            for (let j = 0; j < TOTAL_POINTS - 6; j++) if (points[j].p2 > 0) allHome = false;
          }
          if (allHome) moves.push({ from: i, to: 'off', die: d });
          continue;
        }

        if (target < 0 || target >= TOTAL_POINTS) continue;

        const opp = player === 1 ? points[target].p2 : points[target].p1;
        if (opp <= 1) {
          moves.push({ from: i, to: target, die: d });
        }
      }
    }
  }
  return moves;
}

export default function Backgammon({ mode, difficulty, onGameEnd }) {
  const [points, setPoints] = useState(createBoard);
  const [dice, setDice] = useState([0, 0]);
  const [diceRolled, setDiceRolled] = useState(false);
  const [turn, setTurn] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [movesLeft, setMovesLeft] = useState([]);
  const [barP1, setBarP1] = useState(0);
  const [barP2, setBarP2] = useState(0);
  const [offP1, setOffP1] = useState(0);
  const [offP2, setOffP2] = useState(0);
  const startTimeRef = useRef(Date.now());

  const doRoll = useCallback(() => {
    const d = rollDice();
    setDice(d);
    setDiceRolled(true);
    const moves = d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [...d];
    setMovesLeft(moves);
    return moves;
  }, []);

  const handleRoll = useCallback(() => {
    if (diceRolled) return;
    doRoll();
  }, [diceRolled, doRoll]);

  const makeMove = useCallback((from, to, die) => {
    const newPoints = points.map(p => ({ ...p }));
    let newBarP1 = barP1;
    let newBarP2 = barP2;
    let newOffP1 = offP1;
    let newOffP2 = offP2;

    // Remove piece from source
    if (from === 'bar') {
      if (turn === 1) newBarP1--;
      else newBarP2--;
    } else {
      if (turn === 1) newPoints[from].p1--;
      else newPoints[from].p2--;
    }

    // Place piece at destination
    if (to === 'off') {
      if (turn === 1) newOffP1++;
      else newOffP2++;
    } else {
      // Check if hitting opponent
      if (turn === 1 && newPoints[to].p2 === 1) {
        newPoints[to].p2 = 0;
        newBarP2++;
      }
      if (turn === 2 && newPoints[to].p1 === 1) {
        newPoints[to].p1 = 0;
        newBarP1++;
      }

      if (turn === 1) newPoints[to].p1++;
      else newPoints[to].p2++;
    }

    setPoints(newPoints);
    setBarP1(newBarP1);
    setBarP2(newBarP2);
    setOffP1(newOffP1);
    setOffP2(newOffP2);

    // Remove used die
    const newMoves = [...movesLeft];
    const idx = newMoves.indexOf(die);
    if (idx >= 0) newMoves.splice(idx, 1);
    setMovesLeft(newMoves);

    // Check win
    if ((turn === 1 && newOffP1 + 1 >= PIECES_PER_PLAYER) || 
        (turn === 2 && newOffP2 + 1 >= PIECES_PER_PLAYER)) {
      const winner = turn === 1 ? 1 : (mode === '1p' ? 'bot' : 2);
      setTimeout(() => onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000)), 500);
      return;
    }

    // If no more moves, switch turn
    if (newMoves.length === 0) {
      setTurn(t => t === 1 ? 2 : 1);
      setDiceRolled(false);
      setSelectedPoint(null);
    }
  }, [points, turn, movesLeft, barP1, barP2, offP1, offP2, mode, onGameEnd]);

  const handlePointClick = useCallback((index) => {
    if (!diceRolled || (mode === '1p' && turn === 2)) return;

    if (selectedPoint === null) {
      // Select a point with current player's pieces
      const count = turn === 1 ? points[index].p1 : points[index].p2;
      if (count > 0) setSelectedPoint(index);
    } else {
      // Try to move
      const validMoves = getValidMoves(points, turn, movesLeft, barP1, barP2);
      const move = validMoves.find(m => m.from === selectedPoint && m.to === index);
      if (move) {
        makeMove(move.from, move.to, move.die);
      }
      setSelectedPoint(null);
    }
  }, [selectedPoint, diceRolled, points, turn, movesLeft, barP1, barP2, mode, makeMove]);

  // Bot turn
  useEffect(() => {
    if (mode !== '1p' || turn !== 2) return;
    
    if (!diceRolled) {
      const timer = setTimeout(() => {
        const moves = doRoll();
        // Bot plays after rolling
        setTimeout(() => {
          const validMoves = getValidMoves(points, 2, moves, barP1, barP2);
          if (validMoves.length > 0) {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            makeMove(move.from, move.to, move.die);
          } else {
            setTurn(1);
            setDiceRolled(false);
          }
        }, 600);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [turn, mode, diceRolled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bot continues playing if moves left
  useEffect(() => {
    if (mode !== '1p' || turn !== 2 || !diceRolled || movesLeft.length === 0) return;
    
    const timer = setTimeout(() => {
      const validMoves = getValidMoves(points, 2, movesLeft, barP1, barP2);
      if (validMoves.length > 0) {
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        makeMove(move.from, move.to, move.die);
      } else {
        setTurn(1);
        setDiceRolled(false);
        setMovesLeft([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [movesLeft, turn, mode, diceRolled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render board with DOM
  const renderPoint = (index, isTop) => {
    const p = points[index];
    const pieces = [];
    for (let i = 0; i < p.p1; i++) pieces.push({ player: 1, key: `p1-${i}` });
    for (let i = 0; i < p.p2; i++) pieces.push({ player: 2, key: `p2-${i}` });

    const isSelected = selectedPoint === index;
    const validMoves = diceRolled ? getValidMoves(points, turn, movesLeft, barP1, barP2) : [];
    const isValidTarget = selectedPoint !== null && validMoves.some(m => m.from === selectedPoint && m.to === index);
    const isValidSource = selectedPoint === null && validMoves.some(m => m.from === index);

    return (
      <div
        key={index}
        onClick={() => handlePointClick(index)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isTop ? 'column' : 'column-reverse',
          alignItems: 'center',
          padding: '2px 0',
          cursor: 'pointer',
          position: 'relative',
          background: isSelected ? 'rgba(255,184,48,0.2)' : isValidTarget ? 'rgba(107,203,119,0.15)' : 'transparent',
          borderRadius: 4,
          transition: 'background 0.2s',
          minWidth: 0,
        }}
      >
        {/* Triangle */}
        <div style={{
          width: 0,
          height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          [isTop ? 'borderTop' : 'borderBottom']: `40px solid ${index % 2 === 0 ? '#8B4513' : '#D2691E'}`,
          opacity: 0.6,
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
        }} />
        
        {/* Pieces */}
        {pieces.slice(0, 5).map((piece, i) => (
          <div
            key={piece.key}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: piece.player === 1 ? 'var(--p1-color)' : 'var(--p2-color)',
              border: '2px solid rgba(255,255,255,0.3)',
              flexShrink: 0,
              marginTop: isTop ? (i > 0 ? -4 : 0) : 0,
              marginBottom: !isTop ? (i > 0 ? -4 : 0) : 0,
              position: 'relative',
              zIndex: i,
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {pieces.length > 5 && i === 4 ? `+${pieces.length - 4}` : ''}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0d1117',
      padding: 8,
    }}>
      {/* Score and info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px',
        fontFamily: 'var(--font-display)',
        fontSize: 14,
      }}>
        <span style={{ color: 'var(--p1-color)' }}>P1 Off: {offP1}</span>
        <span style={{ color: turn === 1 ? 'var(--p1-color)' : 'var(--p2-color)' }}>
          {mode === '1p' ? (turn === 1 ? 'Your Turn' : 'Bot') : `Player ${turn}`}
        </span>
        <span style={{ color: 'var(--p2-color)' }}>{mode === '1p' ? 'Bot' : 'P2'} Off: {offP2}</span>
      </div>

      {/* Board */}
      <div style={{
        flex: 1,
        background: '#1a0f07',
        borderRadius: 12,
        border: '3px solid #5a3d2b',
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Top half (points 12-23) */}
        <div style={{ flex: 1, display: 'flex', gap: 1 }}>
          {Array.from({ length: 12 }, (_, i) => renderPoint(12 + i, true))}
        </div>
        
        {/* Center bar */}
        <div style={{
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'rgba(255,255,255,0.05)',
        }}>
          {/* Dice */}
          {diceRolled ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {dice.map((d, i) => (
                <div key={i} style={{
                  width: 36,
                  height: 36,
                  background: '#fff',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#333',
                  opacity: movesLeft.includes(d) ? 1 : 0.3,
                }}>
                  {d}
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={handleRoll}
              disabled={mode === '1p' && turn === 2}
              style={{
                padding: '8px 24px',
                background: 'var(--accent-yellow)',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                cursor: 'pointer',
                color: '#fff',
              }}
            >
              ROLL DICE
            </button>
          )}
          
          {/* Bar pieces */}
          {(barP1 > 0 || barP2 > 0) && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {barP1 > 0 && <span style={{ color: 'var(--p1-color)' }}>Bar: {barP1} </span>}
              {barP2 > 0 && <span style={{ color: 'var(--p2-color)' }}>Bar: {barP2}</span>}
            </div>
          )}
        </div>

        {/* Bottom half (points 11-0, reversed) */}
        <div style={{ flex: 1, display: 'flex', gap: 1 }}>
          {Array.from({ length: 12 }, (_, i) => renderPoint(11 - i, false))}
        </div>
      </div>

      {/* Moves left */}
      <div style={{
        textAlign: 'center',
        padding: '4px',
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        {movesLeft.length > 0 && `Moves left: ${movesLeft.join(', ')}`}
      </div>
    </div>
  );
}
