'use client';

import { sounds, vibrate } from '@/lib/sounds';
import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const Dice3D = dynamic(() => import('@/components/ui/Dice3D'), { ssr: false });

// Simplified Backgammon
const TOTAL_POINTS = 24;
const PIECES_PER_PLAYER = 15;

const INITIAL_P1 = [[23, 2], [12, 5], [7, 3], [5, 5]];
const INITIAL_P2 = [[0, 2], [11, 5], [16, 3], [18, 5]];

// ─── Premium color scheme (classic wooden) ───
const THEME = {
  boardBg: '#2C1A0E',
  boardBorder: '#5A3D2B',
  boardEdge: '#7A5A3E',
  fieldBg: '#1E4D2B',        // Dark green felt
  fieldBgAlt: '#1A4025',
  barBg: '#4A3320',
  barAccent: '#5C4230',
  triLight: '#C49A6C',
  triDark: '#8B5E3C',
  p1: '#F5F0E8',
  p1Border: '#C8BFA8',
  p1Glow: 'rgba(245,240,232,0.25)',
  p1Shadow: 'rgba(200,191,168,0.4)',
  p2: '#1A1A1A',       // Dark/ebony checkers
  p2Border: '#444',
  p2Glow: 'rgba(80,80,80,0.3)',
  p2Shadow: 'rgba(0,0,0,0.5)',
  selected: 'rgba(212,168,85,0.35)',
  validTarget: 'rgba(130,200,100,0.2)',
  diceWhite: '#F8F4EE',
  diceDot: '#1A1A1A',
  gold: '#D4A855',
  textMuted: 'rgba(255,255,255,0.35)',
};

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
  // Use unique dice values to avoid duplicate moves
  const uniqueDice = [...new Set(dice)];
  // But also track available count of each die value
  const diceCount = {};
  dice.forEach(d => { diceCount[d] = (diceCount[d] || 0) + 1; });

  for (const d of uniqueDice) {
    if (bar > 0) {
      // Must re-enter from bar first
      const target = player === 1 ? TOTAL_POINTS - d : d - 1;
      if (target >= 0 && target < TOTAL_POINTS) {
        const opp = player === 1 ? points[target].p2 : points[target].p1;
        if (opp <= 1) moves.push({ from: 'bar', to: target, die: d });
      }
    } else {
      // Normal moves
      for (let i = 0; i < TOTAL_POINTS; i++) {
        const count = player === 1 ? points[i].p1 : points[i].p2;
        if (count <= 0) continue;
        const target = player === 1 ? i - d : i + d;

        // Bearing off check
        if ((player === 1 && target < 0) || (player === 2 && target >= TOTAL_POINTS)) {
          let allHome = true;
          if (player === 1) {
            // P1 home board = points 0-5, also bar must be 0
            for (let j = 6; j < TOTAL_POINTS; j++) if (points[j].p1 > 0) allHome = false;
            if (barP1 > 0) allHome = false;
          } else {
            // P2 home board = points 18-23, also bar must be 0
            for (let j = 0; j < TOTAL_POINTS - 6; j++) if (points[j].p2 > 0) allHome = false;
            if (barP2 > 0) allHome = false;
          }
          if (allHome) {
            // Exact or overshoot bearing off — allow bearing off from the highest point
            if (player === 1) {
              // Can bear off if exact (target == -1 means point 0 with die matching),
              // or if this is the farthest piece and die is bigger
              if (target === -1 || (i === Math.max(...Array.from({length: 6}, (_, k) => points[k].p1 > 0 ? k : -1)))) {
                moves.push({ from: i, to: 'off', die: d });
              }
            } else {
              const farthest = Math.min(...Array.from({length: 6}, (_, k) => points[TOTAL_POINTS - 1 - k].p2 > 0 ? TOTAL_POINTS - 1 - k : TOTAL_POINTS));
              if (target === TOTAL_POINTS || i === farthest) {
                moves.push({ from: i, to: 'off', die: d });
              }
            }
          }
          continue;
        }
        if (target < 0 || target >= TOTAL_POINTS) continue;
        const opp = player === 1 ? points[target].p2 : points[target].p1;
        if (opp <= 1) moves.push({ from: i, to: target, die: d });
      }
    }
  }
  return moves;
}

// ─── Small 2D dice indicator for used/unused state ───
const DiceIndicator = ({ value, used, size = 28 }) => {
  const dotPositions = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]],
  };
  const dots = dotPositions[value] || [];
  const dotR = size * 0.08;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.18,
      background: used ? 'rgba(255,255,255,0.05)' : 'linear-gradient(145deg, #FAF6F0, #E8E0D4)',
      border: used ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: used ? 'none' : '0 2px 4px rgba(0,0,0,0.25)',
      opacity: used ? 0.25 : 1,
      transition: 'all 0.3s',
    }}>
      <svg width={size * 0.8} height={size * 0.8} viewBox={`0 0 ${size} ${size}`}>
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x * size} cy={y * size} r={dotR}
            fill={used ? 'rgba(255,255,255,0.1)' : '#1a1a1a'} />
        ))}
      </svg>
    </div>
  );
};

// ─── Checker piece ───
const Checker = ({ player, stacked, stackIndex, total, isTop }) => {
  const isP1 = player === 1;
  const bgColor = isP1 ? THEME.p1 : THEME.p2;
  const borderColor = isP1 ? THEME.p1Border : THEME.p2Border;
  const innerRing = isP1 ? 'rgba(200,180,140,0.5)' : 'rgba(100,100,100,0.4)';
  const showCount = total > 5 && stackIndex === 4;

  return (
    <div style={{
      width: 'min(7vw, 30px)', height: 'min(7vw, 30px)',
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${isP1 ? '#FFFBF0' : '#3a3a3a'} 0%, ${bgColor} 70%)`,
      border: `2px solid ${borderColor}`,
      boxShadow: `0 2px 4px ${isP1 ? THEME.p1Shadow : THEME.p2Shadow}, inset 0 1px 2px ${isP1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
      flexShrink: 0,
      marginTop: isTop ? (stackIndex > 0 ? -6 : 0) : 0,
      marginBottom: !isTop ? (stackIndex > 0 ? -6 : 0) : 0,
      position: 'relative',
      zIndex: stackIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Inner decorative ring */}
      <div style={{
        width: '60%', height: '60%', borderRadius: '50%',
        border: `1.5px solid ${innerRing}`,
        pointerEvents: 'none',
      }} />
      {showCount && (
        <span style={{
          position: 'absolute', fontSize: 8, fontWeight: 800,
          color: isP1 ? '#5A4A30' : '#ccc',
          fontFamily: 'var(--font-display)',
        }}>+{total - 4}</span>
      )}
    </div>
  );
};

export default function Backgammon({ mode, difficulty, onGameEnd }) {
  const [points, setPoints] = useState(createBoard);
  const [dice, setDice] = useState([0, 0]);
  const [diceRolled, setDiceRolled] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [turn, setTurn] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [movesLeft, setMovesLeft] = useState([]);
  const [barP1, setBarP1] = useState(0);
  const [barP2, setBarP2] = useState(0);
  const [offP1, setOffP1] = useState(0);
  const [offP2, setOffP2] = useState(0);
  const startTimeRef = useRef(Date.now());
  const pendingMovesRef = useRef(null);

  const doRoll = useCallback(() => {
    const finalDice = rollDice();
    setDice(finalDice);
    setRolling(true);
    setDiceRolled(true);
    sounds.tap();
    vibrate(12);

    // Store the moves to be set when 3D animation completes
    const moves = finalDice[0] === finalDice[1]
      ? [finalDice[0], finalDice[0], finalDice[0], finalDice[0]]
      : [...finalDice];
    pendingMovesRef.current = moves;
    return moves;
  }, []);

  // Called when the 3D dice finish their tumble animation
  const handleRollComplete = useCallback(() => {
    setRolling(false);
    vibrate([15, 10, 25]);
    if (pendingMovesRef.current) {
      setMovesLeft(pendingMovesRef.current);
      pendingMovesRef.current = null;
    }
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

    if (from === 'bar') {
      if (turn === 1) newBarP1--;
      else newBarP2--;
    } else {
      if (turn === 1) newPoints[from].p1--;
      else newPoints[from].p2--;
    }

    if (to === 'off') {
      if (turn === 1) newOffP1++;
      else newOffP2++;
      sounds.score();
      vibrate(15);
    } else {
      if (turn === 1 && newPoints[to].p2 === 1) {
        newPoints[to].p2 = 0;
        newBarP2++;
        sounds.score();
        vibrate([10, 8, 10]);
      } else if (turn === 2 && newPoints[to].p1 === 1) {
        newPoints[to].p1 = 0;
        newBarP1++;
        sounds.score();
        vibrate([10, 8, 10]);
      } else {
        sounds.tap();
        vibrate(6);
      }

      if (turn === 1) newPoints[to].p1++;
      else newPoints[to].p2++;
    }

    setPoints(newPoints);
    setBarP1(newBarP1);
    setBarP2(newBarP2);
    setOffP1(newOffP1);
    setOffP2(newOffP2);

    const newMoves = [...movesLeft];
    const idx = newMoves.indexOf(die);
    if (idx >= 0) newMoves.splice(idx, 1);
    setMovesLeft(newMoves);

    if ((turn === 1 && newOffP1 + 1 >= PIECES_PER_PLAYER) ||
        (turn === 2 && newOffP2 + 1 >= PIECES_PER_PLAYER)) {
      const winner = turn === 1 ? 1 : (mode === '1p' ? 'bot' : 2);
      setTimeout(() => onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000)), 500);
      return;
    }

    if (newMoves.length === 0) {
      setTurn(t => t === 1 ? 2 : 1);
      setDiceRolled(false);
      setSelectedPoint(null);
    }
  }, [points, turn, movesLeft, barP1, barP2, offP1, offP2, mode, onGameEnd]);

  const handlePointClick = useCallback((index) => {
    if (!diceRolled || (mode === '1p' && turn === 2)) return;
    if (rolling) return; // don't allow clicks while dice are rolling

    const bar = turn === 1 ? barP1 : barP2;
    const validMoves = getValidMoves(points, turn, movesLeft, barP1, barP2);

    if (bar > 0) {
      // Must re-enter from bar — clicking a target point auto-enters from bar
      const move = validMoves.find(m => m.from === 'bar' && m.to === index);
      if (move) {
        makeMove(move.from, move.to, move.die);
      }
      setSelectedPoint(null);
      return;
    }

    if (selectedPoint === null) {
      // Select a piece source
      const count = turn === 1 ? points[index].p1 : points[index].p2;
      if (count > 0 && validMoves.some(m => m.from === index)) {
        setSelectedPoint(index);
        sounds.tap();
      }
    } else {
      // Try to move to the clicked point
      const move = validMoves.find(m => m.from === selectedPoint && m.to === index);
      if (move) {
        makeMove(move.from, move.to, move.die);
      } else if (index === selectedPoint) {
        // Deselect if clicking the same point
      } else {
        // Try selecting a new piece instead
        const count = turn === 1 ? points[index].p1 : points[index].p2;
        if (count > 0 && validMoves.some(m => m.from === index)) {
          setSelectedPoint(index);
          sounds.tap();
          return;
        }
      }
      setSelectedPoint(null);
    }
  }, [selectedPoint, diceRolled, points, turn, movesLeft, barP1, barP2, mode, makeMove, rolling]);

  // Handle clicking the bar to enter a piece
  const handleBarClick = useCallback(() => {
    if (!diceRolled || (mode === '1p' && turn === 2)) return;
    if (rolling) return;

    const bar = turn === 1 ? barP1 : barP2;
    if (bar <= 0) return;

    const validMoves = getValidMoves(points, turn, movesLeft, barP1, barP2);
    const barMoves = validMoves.filter(m => m.from === 'bar');

    if (barMoves.length === 1) {
      // Only one entry point — auto-move
      makeMove(barMoves[0].from, barMoves[0].to, barMoves[0].die);
    } else if (barMoves.length > 1) {
      // Multiple entry points — highlight them (set selectedPoint to 'bar')
      setSelectedPoint('bar');
      sounds.tap();
    }
  }, [diceRolled, points, turn, movesLeft, barP1, barP2, mode, makeMove, rolling]);

  // Handle clicking a point when bar is selected
  const handleBarTargetClick = useCallback((index) => {
    if (selectedPoint !== 'bar') return;
    const validMoves = getValidMoves(points, turn, movesLeft, barP1, barP2);
    const move = validMoves.find(m => m.from === 'bar' && m.to === index);
    if (move) {
      makeMove(move.from, move.to, move.die);
    }
    setSelectedPoint(null);
  }, [selectedPoint, points, turn, movesLeft, barP1, barP2, makeMove]);

  // Auto-skip if no valid moves
  useEffect(() => {
    if (!diceRolled || movesLeft.length === 0) return;
    if (mode === '1p' && turn === 2) return; // bot handles itself
    const validMoves = getValidMoves(points, turn, movesLeft, barP1, barP2);
    if (validMoves.length === 0) {
      const timer = setTimeout(() => {
        setTurn(t => t === 1 ? 2 : 1);
        setDiceRolled(false);
        setMovesLeft([]);
        setSelectedPoint(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [diceRolled, movesLeft, points, turn, barP1, barP2, mode]);

  // Calculate bot thinking delay based on game complexity
  const getBotDelay = useCallback((validMoves) => {
    const base = 600;
    const moveComplexity = Math.min(validMoves.length, 12) * 80; // more options = more thinking
    const barPenalty = barP2 > 0 ? 300 : 0; // extra thought when on the bar
    const randomJitter = Math.random() * 400;
    return base + moveComplexity + barPenalty + randomJitter;
  }, [barP2]);

  // Bot turn — roll dice
  useEffect(() => {
    if (mode !== '1p' || turn !== 2) return;
    if (!diceRolled) {
      setBotThinking(true);
      const rollDelay = 700 + Math.random() * 500; // pause before rolling
      const timer = setTimeout(() => {
        const moves = doRoll();
        // Wait for dice animation (~800ms) + thinking
        setTimeout(() => {
          const validMoves = getValidMoves(points, 2, moves, barP1, barP2);
          const thinkTime = getBotDelay(validMoves);
          setTimeout(() => {
            if (validMoves.length > 0) {
              const move = validMoves[Math.floor(Math.random() * validMoves.length)];
              makeMove(move.from, move.to, move.die);
            } else {
              setBotThinking(false);
              setTurn(1);
              setDiceRolled(false);
            }
          }, thinkTime);
        }, 900); // wait for dice roll animation to finish
      }, rollDelay);
      return () => clearTimeout(timer);
    }
  }, [turn, mode, diceRolled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bot continues — each subsequent move also has a thinking delay
  useEffect(() => {
    if (mode !== '1p' || turn !== 2 || !diceRolled || movesLeft.length === 0) return;
    const validMoves = getValidMoves(points, 2, movesLeft, barP1, barP2);
    const thinkTime = getBotDelay(validMoves) * 0.7; // slightly faster for follow-up moves
    const timer = setTimeout(() => {
      if (validMoves.length > 0) {
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        makeMove(move.from, move.to, move.die);
      } else {
        setBotThinking(false);
        setTurn(1);
        setDiceRolled(false);
        setMovesLeft([]);
      }
    }, thinkTime);
    return () => clearTimeout(timer);
  }, [movesLeft, turn, mode, diceRolled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear thinking indicator when turn switches to player
  useEffect(() => {
    if (turn === 1) setBotThinking(false);
  }, [turn]);

  // ─── Render triangle point ───
  const renderPoint = (index, isTop) => {
    const p = points[index];
    const pieces = [];
    for (let i = 0; i < p.p1; i++) pieces.push({ player: 1, key: `p1-${i}` });
    for (let i = 0; i < p.p2; i++) pieces.push({ player: 2, key: `p2-${i}` });

    const isSelected = selectedPoint === index;
    const validMoves = diceRolled && !rolling ? getValidMoves(points, turn, movesLeft, barP1, barP2) : [];
    const bar = turn === 1 ? barP1 : barP2;
    // When bar > 0, highlight valid re-entry targets
    const isBarTarget = bar > 0 && validMoves.some(m => m.from === 'bar' && m.to === index);
    const isValidTarget = (selectedPoint !== null && selectedPoint !== 'bar' && validMoves.some(m => m.from === selectedPoint && m.to === index))
      || (selectedPoint === 'bar' && validMoves.some(m => m.from === 'bar' && m.to === index));
    const isValidSource = selectedPoint === null && bar === 0 && validMoves.some(m => m.from === index);
    const triColor = index % 2 === 0 ? THEME.triLight : THEME.triDark;
    // Point numbers (1-24 from white's perspective)
    const pointNum = index + 1;

    return (
      <div
        key={index}
        onClick={() => handlePointClick(index)}
        className="bg-point"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isTop ? 'column' : 'column-reverse',
          alignItems: 'center',
          padding: '3px 0',
          cursor: diceRolled ? 'pointer' : 'default',
          position: 'relative',
          minWidth: 0,
          transition: 'background 0.2s',
        }}
      >
        {/* Triangle via SVG */}
        <svg
          viewBox="0 0 30 90"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            [isTop ? 'top' : 'bottom']: 0,
            width: '100%', height: '90%',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <linearGradient id={`tri-${index}`} x1="0" y1={isTop ? "0" : "1"} x2="0" y2={isTop ? "1" : "0"}>
              <stop offset="0%" stopColor={triColor} stopOpacity="1"/>
              <stop offset="85%" stopColor={triColor} stopOpacity="0.45"/>
              <stop offset="100%" stopColor={triColor} stopOpacity="0.15"/>
            </linearGradient>
          </defs>
          {isTop
            ? <polygon points="15,90 1,0 29,0" fill={`url(#tri-${index})`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
            : <polygon points="15,0 1,90 29,90" fill={`url(#tri-${index})`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
          }
        </svg>

        {/* Point number */}
        <span style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: -1,
          fontSize: 7, fontWeight: 600,
          color: 'rgba(255,255,255,0.18)',
          fontFamily: 'var(--font-display)',
          pointerEvents: 'none', zIndex: 3,
          letterSpacing: 0,
        }}>{pointNum}</span>

        {/* Selection/target highlight */}
        {(isSelected || isValidTarget || isValidSource || isBarTarget) && (
          <div style={{
            position: 'absolute', inset: 0,
            background: isSelected ? THEME.selected
              : isValidTarget ? THEME.validTarget
              : isBarTarget ? 'rgba(80,200,120,0.18)'
              : 'rgba(212,168,85,0.08)',
            borderRadius: 3,
            pointerEvents: 'none',
            zIndex: 1,
            border: isBarTarget ? '1px solid rgba(80,200,120,0.3)' : 'none',
          }} />
        )}

        {/* Pieces */}
        <div style={{
          display: 'flex',
          flexDirection: isTop ? 'column' : 'column-reverse',
          alignItems: 'center',
          position: 'relative', zIndex: 2,
        }}>
          {pieces.slice(0, 5).map((piece, i) => (
            <Checker
              key={piece.key}
              player={piece.player}
              stacked
              stackIndex={i}
              total={pieces.length}
              isTop={isTop}
            />
          ))}
        </div>
      </div>
    );
  };

  // ─── Render bearing-off tray ───
  const renderOffTray = (count, player) => {
    const isP1 = player === 1;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '4px 0',
      }}>
        {Array.from({ length: Math.min(count, 8) }, (_, i) => (
          <div key={i} style={{
            width: 'min(5.5vw, 22px)', height: 'min(2vw, 8px)',
            borderRadius: 2,
            background: isP1
              ? 'linear-gradient(180deg, #F5F0E8 0%, #D8CDB8 100%)'
              : 'linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 100%)',
            border: `1px solid ${isP1 ? THEME.p1Border : THEME.p2Border}`,
            boxShadow: `0 1px 2px ${isP1 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.3)'}`,
          }} />
        ))}
        {count > 8 && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: THEME.textMuted,
            fontFamily: 'var(--font-display)',
          }}>+{count - 8}</span>
        )}
      </div>
    );
  };

  const usedDice = [];
  const remainingCount = {};
  movesLeft.forEach(d => { remainingCount[d] = (remainingCount[d] || 0) + 1; });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'radial-gradient(ellipse at 40% 30%, #1e1810 0%, #0d0a07 60%, #050403 100%)',
      padding: 8,
      gap: 6,
    }}>
      {/* HUD */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2px 6px',
        fontFamily: 'var(--font-display)',
        fontSize: 13,
      }}>
        {/* P1 info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: turn === 1 ? 1 : 0.5, transition: 'opacity 0.3s',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, #FFFBF0, ${THEME.p1})`,
            border: `1.5px solid ${THEME.p1Border}`,
            boxShadow: turn === 1 ? `0 0 8px ${THEME.p1Glow}` : 'none',
          }} />
          <span style={{ color: THEME.p1, letterSpacing: 1 }}>
            {offP1}<span style={{ fontSize: 9, color: THEME.textMuted }}> OFF</span>
          </span>
        </div>

        {/* Turn indicator */}
        <div style={{
          color: turn === 1 ? THEME.gold : '#999',
          letterSpacing: 1.5, fontSize: 12,
          textShadow: `0 0 8px ${turn === 1 ? 'rgba(212,168,85,0.3)' : 'rgba(150,150,150,0.2)'}`,
          textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {mode === '1p'
            ? (turn === 1
              ? 'Your Turn'
              : <><span>Thinking</span><span className="thinking-dots">...</span></>)
            : `Player ${turn}`}
        </div>

        {/* P2 info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: turn === 2 ? 1 : 0.5, transition: 'opacity 0.3s',
        }}>
          <span style={{ color: '#aaa', letterSpacing: 1 }}>
            <span style={{ fontSize: 9, color: THEME.textMuted }}>OFF </span>{offP2}
          </span>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, #3a3a3a, ${THEME.p2})`,
            border: `1.5px solid ${THEME.p2Border}`,
            boxShadow: turn === 2 ? `0 0 8px ${THEME.p2Glow}` : 'none',
          }} />
        </div>
      </div>

      {/* Board */}
      <div style={{
        flex: 1,
        borderRadius: 10,
        border: `3px solid ${THEME.boardEdge}`,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(181,136,99,0.15)',
        position: 'relative',
        background: THEME.boardBg,
      }}>
        {/* Outer frame — wooden border effect */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 8,
          border: `1px solid rgba(122,90,62,0.3)`,
          pointerEvents: 'none', zIndex: 10,
        }} />
        {/* Inner felt surface */}
        <div style={{
          position: 'absolute', inset: 4,
          borderRadius: 6,
          background: `radial-gradient(ellipse at 50% 50%, ${THEME.fieldBg} 0%, ${THEME.fieldBgAlt} 100%)`,
          pointerEvents: 'none', zIndex: 0,
        }} />
        {/* Subtle felt texture */}
        <div style={{
          position: 'absolute', inset: 4,
          borderRadius: 6,
          background: 'repeating-conic-gradient(rgba(0,0,0,0.015) 0% 25%, transparent 0% 50%) 0 0 / 3px 3px',
          pointerEvents: 'none', zIndex: 0,
        }} />
        {/* Gold accent line around playing field */}
        <div style={{
          position: 'absolute', inset: 4,
          borderRadius: 6,
          border: '1px solid rgba(212,168,85,0.12)',
          pointerEvents: 'none', zIndex: 10,
        }} />

        {/* Top half (points 12-23) + off tray */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', zIndex: 1 }}>
          {/* Left 6 points */}
          <div style={{ flex: 6, display: 'flex', gap: 1, padding: '0 2px' }}>
            {Array.from({ length: 6 }, (_, i) => renderPoint(12 + i, true))}
          </div>
          {/* Center bar (top) */}
          <div style={{
            width: 'min(7vw, 32px)',
            background: `linear-gradient(180deg, ${THEME.barBg} 0%, ${THEME.barAccent} 50%, ${THEME.barBg} 100%)`,
            borderLeft: '1px solid rgba(90,66,48,0.6)',
            borderRight: '1px solid rgba(90,66,48,0.6)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', paddingTop: 4,
          }}>
            {/* Bar pieces P2 */}
            {barP2 > 0 && Array.from({ length: Math.min(barP2, 3) }, (_, i) => (
              <div key={i} style={{
                width: 'min(5vw, 20px)', height: 'min(5vw, 20px)',
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, #3a3a3a, ${THEME.p2})`,
                border: `1.5px solid ${THEME.p2Border}`,
                marginTop: i > 0 ? -4 : 0,
                fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#aaa', fontWeight: 700,
              }}>
                {i === 2 && barP2 > 3 ? `+${barP2 - 2}` : ''}
              </div>
            ))}
          </div>
          {/* Right 6 points */}
          <div style={{ flex: 6, display: 'flex', gap: 1, padding: '0 2px' }}>
            {Array.from({ length: 6 }, (_, i) => renderPoint(18 + i, true))}
          </div>
          {/* Off tray P2 */}
          <div style={{
            width: 'min(7vw, 30px)',
            background: THEME.barBg,
            borderLeft: '1px solid rgba(90,66,48,0.4)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          }}>
            {renderOffTray(offP2, 2)}
          </div>
        </div>

        {/* Center dice area */}
        <div style={{
          height: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          background: `linear-gradient(90deg, rgba(30,20,12,0.95) 0%, rgba(50,35,20,0.8) 50%, rgba(30,20,12,0.95) 100%)`,
          borderTop: '1px solid rgba(212,168,85,0.1)',
          borderBottom: '1px solid rgba(212,168,85,0.1)',
          position: 'relative', zIndex: 1,
        }}>
          {diceRolled ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
            }}>
              {/* 3D Dice Scene */}
              <div style={{ marginTop: -10 }}>
                <Dice3D
                  values={dice}
                  rolling={rolling}
                  onRollComplete={handleRollComplete}
                  size={280}
                />
              </div>

              {/* Remaining moves indicator (dots, not dice) */}
              {!rolling && (
                <div style={{
                  display: 'flex', gap: 6, alignItems: 'center',
                  marginTop: -20,
                }}>
                  {dice[0] === dice[1] ? (
                    // Doubles: show filled/empty dots for remaining moves
                    <>
                      {Array.from({ length: 4 }, (_, i) => (
                        <span key={i} style={{
                          fontSize: 10,
                          color: i < movesLeft.length ? THEME.gold : 'rgba(255,255,255,0.15)',
                          transition: 'color 0.3s',
                        }}>{i < movesLeft.length ? '●' : '○'}</span>
                      ))}
                      <span style={{
                        fontSize: 10, color: THEME.gold, fontFamily: 'var(--font-display)',
                        letterSpacing: 1, marginLeft: 2,
                      }}>×{movesLeft.length}</span>
                    </>
                  ) : (
                    // Normal: show which values are still available
                    dice.map((d, i) => {
                      const isUsed = (() => {
                        const remaining = [...movesLeft];
                        const usedArr = [];
                        for (let j = 0; j < i; j++) {
                          const idx = remaining.indexOf(dice[j]);
                          if (idx >= 0) { remaining.splice(idx, 1); usedArr.push(j); }
                        }
                        return !remaining.includes(d);
                      })();
                      return (
                        <span key={i} style={{
                          fontSize: 13, fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          color: isUsed ? 'rgba(255,255,255,0.15)' : THEME.gold,
                          textDecoration: isUsed ? 'line-through' : 'none',
                          transition: 'all 0.3s',
                        }}>{d}</span>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleRoll}
              disabled={mode === '1p' && turn === 2}
              className="roll-btn"
              style={{
                padding: '10px 32px',
                background: `linear-gradient(135deg, ${THEME.gold} 0%, #B8862D 100%)`,
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                cursor: 'pointer',
                color: '#fff',
                letterSpacing: 2,
                textTransform: 'uppercase',
                boxShadow: '0 3px 12px rgba(212,168,85,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                transition: 'all 0.2s',
              }}
            >
              🎲 ROLL DICE
            </button>
          )}

          {/* Bar pieces indicator */}
          {(barP1 > 0 || barP2 > 0) && (
            <div style={{
              position: 'absolute', right: 'min(8vw, 36px)', top: '50%', transform: 'translateY(-50%)',
              fontSize: 10, color: THEME.textMuted, fontFamily: 'var(--font-display)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {barP1 > 0 && <span style={{ color: THEME.p1Border }}>Bar: {barP1}</span>}
              {barP2 > 0 && <span style={{ color: '#666' }}>Bar: {barP2}</span>}
            </div>
          )}
        </div>

        {/* Bottom half (points 11-0, reversed) + off tray */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', zIndex: 1 }}>
          <div style={{ flex: 6, display: 'flex', gap: 1, padding: '0 2px' }}>
            {Array.from({ length: 6 }, (_, i) => renderPoint(11 - i, false))}
          </div>
          <div style={{
            width: 'min(7vw, 32px)',
            background: `linear-gradient(180deg, ${THEME.barBg} 0%, ${THEME.barAccent} 50%, ${THEME.barBg} 100%)`,
            borderLeft: '1px solid rgba(90,66,48,0.6)',
            borderRight: '1px solid rgba(90,66,48,0.6)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-end', paddingBottom: 4,
          }}>
            {barP1 > 0 && Array.from({ length: Math.min(barP1, 3) }, (_, i) => (
              <div key={i} style={{
                width: 'min(5vw, 20px)', height: 'min(5vw, 20px)',
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, #FFFBF0, ${THEME.p1})`,
                border: `1.5px solid ${THEME.p1Border}`,
                marginBottom: i > 0 ? -4 : 0,
                fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#5A4A30', fontWeight: 700,
              }}>
                {i === 2 && barP1 > 3 ? `+${barP1 - 2}` : ''}
              </div>
            ))}
          </div>
          <div style={{ flex: 6, display: 'flex', gap: 1, padding: '0 2px' }}>
            {Array.from({ length: 6 }, (_, i) => renderPoint(5 - i, false))}
          </div>
          <div style={{
            width: 'min(7vw, 30px)',
            background: THEME.barBg,
            borderLeft: '1px solid rgba(90,66,48,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
            {renderOffTray(offP1, 1)}
          </div>
        </div>
      </div>

      {/* Moves left */}
      <div style={{
        textAlign: 'center',
        padding: '2px',
        fontSize: 10,
        color: THEME.textMuted,
        fontFamily: 'var(--font-display)',
        letterSpacing: 1,
        minHeight: 16,
      }}>
        {movesLeft.length > 0 && `Moves left: ${movesLeft.join(' · ')}`}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes thinkDots {
          0%, 20% { opacity: 0.2; }
          40% { opacity: 1; }
          60%, 100% { opacity: 0.2; }
        }
        .thinking-dots {
          display: inline-flex;
          letter-spacing: 2px;
          animation: thinkDots 1.4s ease-in-out infinite;
        }
        .roll-btn:hover {
          filter: brightness(1.12);
          transform: scale(1.03);
        }
        .roll-btn:active {
          transform: scale(0.97);
        }
        .bg-point:hover {
          background: rgba(181,136,99,0.06);
        }
      `}</style>
    </div>
  );
}
