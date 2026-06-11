'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sounds, vibrate } from '@/lib/sounds';

const EMPTY = null;
const P1 = 'X';
const P2 = 'O';
const TURN_TIME = 10; // seconds

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6],          // diags
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  if (board.every(c => c !== EMPTY)) return { winner: 'draw', line: null };
  return null;
}

// Minimax AI
function minimax(board, isMaximizing, depth = 0) {
  const result = checkWinner(board);
  if (result) {
    if (result.winner === P2) return 10 - depth;
    if (result.winner === P1) return depth - 10;
    return 0;
  }

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === EMPTY) {
        board[i] = P2;
        best = Math.max(best, minimax(board, false, depth + 1));
        board[i] = EMPTY;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === EMPTY) {
        board[i] = P1;
        best = Math.min(best, minimax(board, true, depth + 1));
        board[i] = EMPTY;
      }
    }
    return best;
  }
}

function getBotMove(board, difficulty) {
  const empty = board.map((c, i) => c === EMPTY ? i : -1).filter(i => i >= 0);
  if (empty.length === 0) return -1;

  const diffId = difficulty?.id || 'normal';
  const randomChance = diffId === 'easy' ? 0.4 : diffId === 'normal' ? 0.15 : 0;

  if (Math.random() < randomChance) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const i of empty) {
    board[i] = P2;
    const score = minimax(board, false, 0);
    board[i] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}

export default function TicTacToe({ mode, difficulty, onGameEnd }) {
  const [board, setBoard] = useState(Array(9).fill(EMPTY));
  const [turn, setTurn] = useState(P1);
  const [result, setResult] = useState(null);
  const [winLine, setWinLine] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const startTimeRef = useRef(Date.now());
  const turnStartRef = useRef(Date.now());
  const timerRef = useRef(null);

  // Reset turn timer whenever turn changes
  useEffect(() => {
    turnStartRef.current = Date.now();
    setTimeLeft(TURN_TIME);

    if (result) return;

    // Don't run the countdown timer for bot turns in 1p mode
    const isBotTurn = mode === '1p' && turn === P2;
    if (isBotTurn) return;

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - turnStartRef.current) / 1000;
      const remaining = Math.max(0, TURN_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        // Time's up — skip turn
        sounds.miss();
        vibrate(15);
        setTurn(prev => prev === P1 ? P2 : P1);
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [turn, result, mode]);

  // Bot move
  useEffect(() => {
    if (mode === '1p' && turn === P2 && !result) {
      const timer = setTimeout(() => {
        const newBoard = [...board];
        const move = getBotMove([...board], difficulty);
        if (move >= 0) {
          newBoard[move] = P2;
          setBoard(newBoard);
          sounds.tap();
          const gameResult = checkWinner(newBoard);
          if (gameResult) {
            setResult(gameResult);
            setWinLine(gameResult.line);
            if (gameResult.winner !== 'draw') sounds.score();
            const winner = gameResult.winner === P2 ? 'bot' : gameResult.winner === P1 ? 1 : 'draw';
            setTimeout(() => {
              onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000));
            }, 800);
          } else {
            setTurn(P1);
          }
        }
      }, 500 + Math.random() * 400);
      return () => clearTimeout(timer);
    }
  }, [turn, mode, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMove = useCallback((index) => {
    if (board[index] !== EMPTY || result) return;
    if (mode === '1p' && turn === P2) return;

    clearInterval(timerRef.current);

    const newBoard = [...board];
    newBoard[index] = turn;
    setBoard(newBoard);
    sounds.tap();
    vibrate(10);

    const gameResult = checkWinner(newBoard);
    if (gameResult) {
      setResult(gameResult);
      setWinLine(gameResult.line);
      if (gameResult.winner === 'draw') {
        sounds.miss();
      } else {
        sounds.score();
        vibrate([30, 20, 30]);
      }
      const winner = gameResult.winner === P1 ? 1 : gameResult.winner === P2 ? (mode === '1p' ? 'bot' : 2) : 'draw';
      setTimeout(() => {
        onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 800);
      return;
    }

    setTurn(turn === P1 ? P2 : P1);
  }, [board, turn, result, mode, onGameEnd]);

  const progress = timeLeft / TURN_TIME;
  const isBotTurn = mode === '1p' && turn === P2;
  const barColor = turn === P1 ? '#FF6B6B' : '#4ECDC4';
  const isUrgent = timeLeft <= 3 && !result && !isBotTurn;
  const moveCount = board.filter(c => c !== EMPTY).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '20px',
      background: 'radial-gradient(ellipse at 30% 20%, #161b2e 0%, #0d1117 60%, #080a0f 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient floating orbs */}
      <div style={{
        position: 'absolute', top: '10%', left: '5%',
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,107,107,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '8%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      {/* Score / Turn HUD */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        marginBottom: 10,
      }}>
        {/* P1 icon */}
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: turn === P1 && !result ? 'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.04)',
          border: turn === P1 && !result ? '2px solid rgba(255,107,107,0.5)' : '2px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontFamily: 'var(--font-display)',
          color: '#FF6B6B',
          transition: 'all 0.3s',
          boxShadow: turn === P1 && !result ? '0 0 12px rgba(255,107,107,0.2)' : 'none',
        }}>✕</div>

        {/* Turn label */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: result ? 'rgba(255,255,255,0.5)' : (turn === P1 ? '#FF6B6B' : '#4ECDC4'),
          transition: 'color 0.3s',
          textShadow: result ? 'none' : `0 0 12px ${turn === P1 ? 'rgba(255,107,107,0.3)' : 'rgba(78,205,196,0.3)'}`,
        }}>
          {result
            ? (result.winner === 'draw' ? "DRAW" : `${result.winner === P1 ? 'P1' : 'P2'} WINS`)
            : (mode === '1p'
              ? (turn === P1 ? 'YOUR TURN' : 'BOT...')
              : `PLAYER ${turn === P1 ? '1' : '2'}`)
          }
        </div>

        {/* P2 icon */}
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: turn === P2 && !result ? 'rgba(78,205,196,0.15)' : 'rgba(255,255,255,0.04)',
          border: turn === P2 && !result ? '2px solid rgba(78,205,196,0.5)' : '2px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontFamily: 'var(--font-display)',
          color: '#4ECDC4',
          transition: 'all 0.3s',
          boxShadow: turn === P2 && !result ? '0 0 12px rgba(78,205,196,0.2)' : 'none',
        }}>○</div>
      </div>

      {/* Timer Bar */}
      {!result && (
        <div style={{
          width: 'min(85vw, 340px)',
          height: 5,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          marginBottom: 6,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: turn === P1 ? 0 : 'auto',
            right: turn === P2 ? 0 : 'auto',
            height: '100%',
            width: isBotTurn ? '100%' : `${progress * 100}%`,
            background: isBotTurn
              ? `repeating-linear-gradient(90deg, ${barColor}22 0px, ${barColor}22 6px, transparent 6px, transparent 12px)`
              : `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
            borderRadius: 3,
            transition: 'width 0.05s linear',
            boxShadow: isUrgent ? `0 0 10px ${barColor}` : `0 0 4px ${barColor}44`,
            animation: isUrgent ? 'timerPulse 0.5s ease-in-out infinite' : 'none',
          }} />
        </div>
      )}

      {/* Time text */}
      {!result && !isBotTurn && (
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          color: isUrgent ? barColor : 'rgba(255,255,255,0.25)',
          marginBottom: 12,
          letterSpacing: 1,
        }}>
          {Math.ceil(timeLeft)}s
        </div>
      )}
      {(result || isBotTurn) && <div style={{ height: 23 }} />}

      {/* Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        width: 'min(82vw, 330px)',
        aspectRatio: '1',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(10px)',
        borderRadius: 20,
        padding: 10,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {board.map((cell, i) => {
          const isWin = winLine?.includes(i);
          const isEmpty = cell === EMPTY;
          const isP1Cell = cell === P1;

          return (
            <button
              key={i}
              id={`cell-${i}`}
              onClick={() => handleMove(i)}
              className="ttt-cell"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isWin
                  ? 'rgba(255, 215, 0, 0.12)'
                  : isEmpty && !result
                    ? 'rgba(255,255,255,0.025)'
                    : 'rgba(255,255,255,0.04)',
                border: isWin
                  ? '1px solid rgba(255,215,0,0.3)'
                  : '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14,
                fontSize: 'min(14vw, 52px)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                cursor: isEmpty && !result ? 'pointer' : 'default',
                transition: 'all 0.25s ease',
                color: 'transparent',
                aspectRatio: '1',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isWin
                  ? '0 0 20px rgba(255,215,0,0.15), inset 0 0 15px rgba(255,215,0,0.05)'
                  : cell
                    ? `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.2)`
                    : 'none',
              }}
            >
              {/* X mark */}
              {cell === P1 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="55%" height="55%" viewBox="0 0 40 40" fill="none">
                    <line x1="6" y1="6" x2="34" y2="34" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(255,107,107,0.5))' }} />
                    <line x1="34" y1="6" x2="6" y2="34" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(255,107,107,0.5))' }} />
                  </svg>
                </div>
              )}

              {/* O mark */}
              {cell === P2 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="55%" height="55%" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="14" stroke="#4ECDC4" strokeWidth="5" fill="none"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(78,205,196,0.5))' }} />
                  </svg>
                </div>
              )}

              {/* Hover pulse for empty cells */}
              {isEmpty && !result && (
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 14,
                  background: `radial-gradient(circle, ${turn === P1 ? 'rgba(255,107,107,0.04)' : 'rgba(78,205,196,0.04)'} 0%, transparent 70%)`,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }} className="cell-hover-glow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Move count */}
      <div style={{
        marginTop: 16,
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.15)',
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        Move {moveCount} / 9
      </div>

      <style jsx>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .ttt-cell:hover .cell-hover-glow {
          opacity: 1 !important;
        }
        .ttt-cell:hover {
          transform: scale(1.03);
          border-color: rgba(255,255,255,0.12) !important;
        }
        .ttt-cell:active {
          transform: scale(0.97);
        }
      `}</style>
    </div>
  );
}
