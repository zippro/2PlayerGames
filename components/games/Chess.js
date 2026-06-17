'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sounds, vibrate } from '@/lib/sounds';

// ─── Piece definitions ───
const EMPTY = null;
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const TURN_TIME = 30;

// ─── SVG Chess Pieces ───
const PieceSVG = ({ piece, size = '80%' }) => {
  const w = isWhitePiece(piece);
  const fill = w ? '#FFFFFF' : '#1a1a1a';
  const stroke = w ? '#333333' : '#FFFFFF';
  const sw = 1.5;
  const type = piece.toLowerCase();

  const svgProps = {
    width: size, height: size, viewBox: '0 0 45 45',
    style: {
      filter: `drop-shadow(0 2px 3px rgba(0,0,0,${w ? '0.35' : '0.5'}))`,
    },
  };

  switch (type) {
    case 'k': return (
      <svg {...svgProps}>
        <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Cross on top */}
          <path d="M 22.5 11.5 L 22.5 6" strokeWidth={2}/>
          <path d="M 20 8 L 25 8" strokeWidth={2}/>
          {/* Crown body */}
          <path d="M 22.5 25 C 22.5 25 27 17.5 25.5 14.5 C 25.5 14.5 24.5 12 22.5 12 C 20.5 12 19.5 14.5 19.5 14.5 C 18 17.5 22.5 25 22.5 25"/>
          <path d="M 12.5 37 C 18 40.5 27 40.5 32.5 37 L 32.5 30 C 32.5 30 41.5 25.5 38.5 19.5 C 34.5 13 25 16 22.5 23.5 L 22.5 27 L 22.5 23.5 C 20 16 10.5 13 6.5 19.5 C 3.5 25.5 12.5 30 12.5 30 L 12.5 37"/>
          <path d="M 12.5 30 C 18 27 27 27 32.5 30" fill="none"/>
          <path d="M 12.5 33.5 C 18 30.5 27 30.5 32.5 33.5" fill="none"/>
          <path d="M 12.5 37 C 18 34 27 34 32.5 37" fill="none"/>
        </g>
      </svg>
    );
    case 'q': return (
      <svg {...svgProps}>
        <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Crown points with circles */}
          <circle cx="6" cy="12" r="2.5"/>
          <circle cx="14" cy="9" r="2.5"/>
          <circle cx="22.5" cy="8" r="2.5"/>
          <circle cx="31" cy="9" r="2.5"/>
          <circle cx="39" cy="12" r="2.5"/>
          <path d="M 9 26 C 17.5 24.5 30 24.5 36 26 L 39 14.5 L 31 25 L 22.5 10 L 14 25 L 6 14.5 L 9 26 Z"/>
          <path d="M 9 26 C 9 28 10.5 30 22.5 30 C 34.5 30 36 28 36 26 C 30 24.5 17.5 24.5 9 26 Z"/>
          <path d="M 9 29 C 9 31 12.5 35.5 22.5 35.5 C 32.5 35.5 36 31 36 29 C 30 28.5 17.5 28.5 9 29 Z" fill="none"/>
          <path d="M 9.5 37 C 9.5 39 14.5 41 22.5 41 C 30.5 41 35.5 39 35.5 37 L 35.5 34.5 C 30 36 15 36 9.5 34.5 L 9.5 37 Z"/>
        </g>
      </svg>
    );
    case 'r': return (
      <svg {...svgProps}>
        <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Battlements */}
          <path d="M 9 39 L 36 39 L 36 36 L 9 36 L 9 39 Z"/>
          <path d="M 12 36 L 12 32 L 33 32 L 33 36 L 12 36 Z"/>
          <path d="M 11 14 L 11 9 L 15 9 L 15 11 L 20 11 L 20 9 L 25 9 L 25 11 L 30 11 L 30 9 L 34 9 L 34 14 Z"/>
          <path d="M 34 14 L 31 17 L 14 17 L 11 14"/>
          <path d="M 31 17 L 31 29.5 L 14 29.5 L 14 17"/>
          <path d="M 31 29.5 L 33 32 L 12 32 L 14 29.5"/>
          <path d="M 14 17 L 31 17" fill="none"/>
          <path d="M 14 20 L 31 20" fill="none"/>
          <path d="M 14 23.5 L 31 23.5" fill="none" strokeWidth={0.8}/>
        </g>
      </svg>
    );
    case 'b': return (
      <svg {...svgProps}>
        <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Cross on top */}
          <path d="M 22.5 9 C 22.5 9 24 7.5 24 6 C 24 4 22.5 3.5 22.5 3.5 C 22.5 3.5 21 4 21 6 C 21 7.5 22.5 9 22.5 9 Z" fill={fill}/>
          {/* Body */}
          <path d="M 15 32 C 17.5 34.5 27.5 34.5 30 32 C 30.5 30.5 30 30 30 30 C 30 27.5 27.5 26 27.5 26 C 33 24.5 33.5 14.5 22.5 10.5 C 11.5 14.5 12 24.5 17.5 26 C 17.5 26 15 27.5 15 30 C 15 30 14.5 30.5 15 32 Z"/>
          <path d="M 25 8 C 25.5 10 25 11.5 25 12.5 C 25 13.5 25.5 16 24 18" fill="none"/>
          {/* Base */}
          <path d="M 9.5 36 C 12.5 37.5 32.5 37.5 35.5 36 L 35.5 33.5 C 32.5 35 12.5 35 9.5 33.5 Z"/>
          <path d="M 9.5 40 C 12.5 41.5 32.5 41.5 35.5 40 L 35.5 37 C 32.5 38.5 12.5 38.5 9.5 37 Z"/>
        </g>
      </svg>
    );
    case 'n': return (
      <svg {...svgProps}>
        <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Knight head and body */}
          <path d="M 22 10 C 32.5 11 38.5 18 38 39 L 15 39 C 15 30 25 32.5 23 18"/>
          <path d="M 24 18 C 24.38 20.91 18.45 25.37 16 27 C 13 29 13.18 31.34 11 31 C 9.958 30.06 12.41 27.96 11 28 C 10 28 11.19 29.23 10 30 C 9 30 5.997 31 6 26 C 6 24 12 14 12 14 C 12 14 13.89 12.1 14 10.5 C 13.27 9.506 13.5 8.5 13.5 7.5 C 14.5 6.5 16.5 10 16.5 10 L 18.5 10 C 18.5 10 19.28 8.008 21 7 C 22 7 22 10 22 10"/>
          {/* Eye */}
          <circle cx="17" cy="16" r="1.5" fill={stroke} stroke="none"/>
          {/* Nostril */}
          <circle cx="10.5" cy="25.5" r="0.8" fill={stroke} stroke="none"/>
        </g>
      </svg>
    );
    case 'p': return (
      <svg {...svgProps}>
        <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Head */}
          <circle cx="22.5" cy="12" r="5.5"/>
          {/* Body */}
          <path d="M 17 25 C 17 25 14 27 14 30 C 14 33 19 35 22.5 35 C 26 35 31 33 31 30 C 31 27 28 25 28 25 L 17 25 Z"/>
          <path d="M 17.5 25 L 18.5 20 C 18.5 18 22.5 17 22.5 17 C 22.5 17 26.5 18 26.5 20 L 27.5 25"/>
          {/* Base */}
          <path d="M 10 39 C 10 39 13.5 37 22.5 37 C 31.5 37 35 39 35 39 L 35 41 C 35 41 31.5 39.5 22.5 39.5 C 13.5 39.5 10 41 10 41 Z"/>
        </g>
      </svg>
    );
    default: return null;
  }
};

// Unicode fallback for captured pieces display
const PIECE_CHARS = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

// ─── Initial board ───
function createBoard() {
  return [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R'],
  ];
}

function isWhitePiece(piece) { return piece && piece === piece.toUpperCase(); }
function isBlackPiece(piece) { return piece && piece === piece.toLowerCase(); }
function isPlayer(piece, player) {
  return player === 1 ? isWhitePiece(piece) : isBlackPiece(piece);
}

function cloneBoard(board) {
  return board.map(row => [...row]);
}

// ─── Move generation ───
function getRawMoves(board, row, col, enPassant, castling) {
  const piece = board[row][col];
  if (!piece) return [];
  const moves = [];
  const white = isWhitePiece(piece);
  const type = piece.toLowerCase();
  const friendly = (r, c) => {
    if (r < 0 || r > 7 || c < 0 || c > 7) return true;
    return white ? isWhitePiece(board[r][c]) : isBlackPiece(board[r][c]);
  };
  const enemy = (r, c) => {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    return white ? isBlackPiece(board[r][c]) : isWhitePiece(board[r][c]);
  };
  const empty = (r, c) => r >= 0 && r <= 7 && c >= 0 && c <= 7 && !board[r][c];

  if (type === 'p') {
    const dir = white ? -1 : 1;
    const startRow = white ? 6 : 1;
    if (empty(row + dir, col)) {
      moves.push([row + dir, col]);
      if (row === startRow && empty(row + 2 * dir, col)) {
        moves.push([row + 2 * dir, col]);
      }
    }
    if (col > 0 && enemy(row + dir, col - 1)) moves.push([row + dir, col - 1]);
    if (col < 7 && enemy(row + dir, col + 1)) moves.push([row + dir, col + 1]);
    if (enPassant) {
      const [epR, epC] = enPassant;
      if (row + dir === epR && Math.abs(col - epC) === 1) {
        moves.push([epR, epC, 'enpassant']);
      }
    }
  } else if (type === 'n') {
    const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of jumps) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r <= 7 && c >= 0 && c <= 7 && !friendly(r, c)) {
        moves.push([r, c]);
      }
    }
  } else if (type === 'b' || type === 'r' || type === 'q') {
    const dirs = [];
    if (type === 'b' || type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
    if (type === 'r' || type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for (const [dr, dc] of dirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        if (friendly(r, c)) break;
        moves.push([r, c]);
        if (enemy(r, c)) break;
        r += dr; c += dc;
      }
    }
  } else if (type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r >= 0 && r <= 7 && c >= 0 && c <= 7 && !friendly(r, c)) {
          moves.push([r, c]);
        }
      }
    }
    if (castling) {
      const player = white ? 1 : 2;
      const kingRow = white ? 7 : 0;
      if (row === kingRow && col === 4) {
        if (castling[player]?.k && !board[kingRow][5] && !board[kingRow][6] &&
            board[kingRow][7] && board[kingRow][7].toLowerCase() === 'r' && isPlayer(board[kingRow][7], player)) {
          if (!isSquareAttacked(board, kingRow, 4, player) &&
              !isSquareAttacked(board, kingRow, 5, player) &&
              !isSquareAttacked(board, kingRow, 6, player)) {
            moves.push([kingRow, 6, 'castle-k']);
          }
        }
        if (castling[player]?.q && !board[kingRow][3] && !board[kingRow][2] && !board[kingRow][1] &&
            board[kingRow][0] && board[kingRow][0].toLowerCase() === 'r' && isPlayer(board[kingRow][0], player)) {
          if (!isSquareAttacked(board, kingRow, 4, player) &&
              !isSquareAttacked(board, kingRow, 3, player) &&
              !isSquareAttacked(board, kingRow, 2, player)) {
            moves.push([kingRow, 2, 'castle-q']);
          }
        }
      }
    }
  }
  return moves;
}

function isSquareAttacked(board, row, col, byPlayer) {
  const attacker = byPlayer === 1 ? 2 : 1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isPlayer(board[r][c], attacker)) continue;
      const moves = getRawMoves(board, r, c, null, null);
      if (moves.some(m => m[0] === row && m[1] === col)) return true;
    }
  }
  return false;
}

function findKing(board, player) {
  const king = player === 1 ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === king) return [r, c];
    }
  }
  return null;
}

function isInCheck(board, player) {
  const kp = findKing(board, player);
  if (!kp) return false;
  return isSquareAttacked(board, kp[0], kp[1], player);
}

function applyMove(board, fromR, fromC, toR, toC, special) {
  const newBoard = cloneBoard(board);
  const piece = newBoard[fromR][fromC];

  if (special === 'enpassant') {
    newBoard[fromR][toC] = null;
  } else if (special === 'castle-k') {
    newBoard[fromR][5] = newBoard[fromR][7];
    newBoard[fromR][7] = null;
  } else if (special === 'castle-q') {
    newBoard[fromR][3] = newBoard[fromR][0];
    newBoard[fromR][0] = null;
  }

  newBoard[toR][toC] = piece;
  newBoard[fromR][fromC] = null;

  if (piece && piece.toLowerCase() === 'p') {
    if ((isWhitePiece(piece) && toR === 0) || (isBlackPiece(piece) && toR === 7)) {
      newBoard[toR][toC] = isWhitePiece(piece) ? 'Q' : 'q';
    }
  }

  return newBoard;
}

function getLegalMoves(board, row, col, player, enPassant, castling) {
  const piece = board[row][col];
  if (!piece || !isPlayer(piece, player)) return [];
  const raw = getRawMoves(board, row, col, enPassant, castling);
  const legal = [];
  for (const move of raw) {
    const [toR, toC, special] = move;
    const newBoard = applyMove(board, row, col, toR, toC, special);
    if (!isInCheck(newBoard, player)) {
      legal.push(move);
    }
  }
  return legal;
}

function getAllLegalMoves(board, player, enPassant, castling) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isPlayer(board[r][c], player)) continue;
      const pieceMoves = getLegalMoves(board, r, c, player, enPassant, castling);
      for (const m of pieceMoves) {
        moves.push({ from: [r, c], to: [m[0], m[1]], special: m[2] });
      }
    }
  }
  return moves;
}

// ─── Simple Bot AI ───
function evaluateBoard(board) {
  let score = 0;
  const centerBonus = [
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,1,2,2,1,0,0],
    [0,0,2,3,3,2,0,0],
    [0,0,2,3,3,2,0,0],
    [0,0,1,2,2,1,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.toLowerCase()] || 0;
      const posBonus = centerBonus[r][c] * 0.1;
      if (isBlackPiece(p)) {
        score += val + posBonus;
      } else {
        score -= val + posBonus;
      }
    }
  }
  return score;
}

function getBotMove(board, enPassant, castling, difficulty) {
  const allMoves = getAllLegalMoves(board, 2, enPassant, castling);
  if (allMoves.length === 0) return null;
  const diffId = difficulty?.id || 'normal';
  if (diffId === 'easy' && Math.random() < 0.6) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of allMoves) {
    const newBoard = applyMove(board, move.from[0], move.from[1], move.to[0], move.to[1], move.special);
    let score = evaluateBoard(newBoard);
    if (isInCheck(newBoard, 1)) score += 0.5;
    const captured = board[move.to[0]][move.to[1]];
    if (captured) score += PIECE_VALUES[captured.toLowerCase()] * 0.5;
    const noise = diffId === 'normal' ? Math.random() * 1.5 : Math.random() * 0.3;
    score += noise;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ─── Board colors (classic wooden) ───
const BOARD = {
  light: '#B58863',
  dark: '#6D4C2E',
  selectedLight: '#E8C36A',
  selectedDark: '#C9A33A',
  lastMoveLight: '#CDD26A',
  lastMoveDark: '#AAB035',
  checkBg: '#E84040',
  labelLight: 'rgba(109,76,46,0.8)',
  labelDark: 'rgba(181,136,99,0.6)',
};

// ─── Chess Component ───
export default function Chess({ mode, difficulty, onGameEnd }) {
  const [board, setBoard] = useState(createBoard);
  const [turn, setTurn] = useState(1);
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [enPassant, setEnPassant] = useState(null);
  const [castling, setCastling] = useState({
    1: { k: true, q: true },
    2: { k: true, q: true },
  });
  const [capturedWhite, setCapturedWhite] = useState([]);
  const [capturedBlack, setCapturedBlack] = useState([]);
  const [gameStatus, setGameStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const startTimeRef = useRef(Date.now());
  const turnStartRef = useRef(Date.now());
  const timerRef = useRef(null);
  const [moveCount, setMoveCount] = useState(0);
  const gameOverRef = useRef(false);

  // Timer
  useEffect(() => {
    turnStartRef.current = Date.now();
    setTimeLeft(TURN_TIME);
    if (gameOverRef.current) return;
    const isBotTurn = mode === '1p' && turn === 2;
    if (isBotTurn) return;

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - turnStartRef.current) / 1000;
      const remaining = Math.max(0, TURN_TIME - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        sounds.miss();
        vibrate(15);
        gameOverRef.current = true;
        const winner = turn === 1 ? (mode === '1p' ? 'bot' : 2) : 1;
        setTimeout(() => onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000)), 300);
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [turn, mode, onGameEnd]);

  // Check game status
  useEffect(() => {
    if (gameOverRef.current) return;
    const opponent = turn;
    const inCheck = isInCheck(board, opponent);
    const moves = getAllLegalMoves(board, opponent, enPassant, castling);

    if (moves.length === 0) {
      gameOverRef.current = true;
      if (inCheck) {
        setGameStatus('checkmate');
        const winner = opponent === 1 ? (mode === '1p' ? 'bot' : 2) : 1;
        sounds.score();
        vibrate([30, 20, 30]);
        setTimeout(() => onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000)), 1000);
      } else {
        setGameStatus('stalemate');
        sounds.miss();
        setTimeout(() => onGameEnd('draw', Math.round((Date.now() - startTimeRef.current) / 1000)), 1000);
      }
    } else if (inCheck) {
      setGameStatus('check');
    } else {
      setGameStatus(null);
    }
  }, [board, turn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bot move
  useEffect(() => {
    if (mode !== '1p' || turn !== 2 || gameOverRef.current) return;
    const timer = setTimeout(() => {
      const move = getBotMove(board, enPassant, castling, difficulty);
      if (move) {
        executeMove(move.from[0], move.from[1], move.to[0], move.to[1], move.special);
      }
    }, 600 + Math.random() * 500);
    return () => clearTimeout(timer);
  }, [turn, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const executeMove = useCallback((fromR, fromC, toR, toC, special) => {
    const piece = board[fromR][fromC];
    const captured = board[toR][toC];

    if (special === 'enpassant') {
      const capPiece = board[fromR][toC];
      if (capPiece) {
        if (isWhitePiece(capPiece)) setCapturedWhite(prev => [...prev, capPiece]);
        else setCapturedBlack(prev => [...prev, capPiece]);
      }
    } else if (captured) {
      if (isWhitePiece(captured)) setCapturedWhite(prev => [...prev, captured]);
      else setCapturedBlack(prev => [...prev, captured]);
    }

    const newBoard = applyMove(board, fromR, fromC, toR, toC, special);
    setBoard(newBoard);
    setLastMove({ from: [fromR, fromC], to: [toR, toC] });
    setSelected(null);
    setLegalMoves([]);
    setMoveCount(m => m + 1);

    if (piece && piece.toLowerCase() === 'p' && Math.abs(toR - fromR) === 2) {
      setEnPassant([(fromR + toR) / 2, fromC]);
    } else {
      setEnPassant(null);
    }

    setCastling(prev => {
      const next = { 1: { ...prev[1] }, 2: { ...prev[2] } };
      if (piece === 'K') { next[1].k = false; next[1].q = false; }
      if (piece === 'k') { next[2].k = false; next[2].q = false; }
      if (piece === 'R' && fromR === 7 && fromC === 7) next[1].k = false;
      if (piece === 'R' && fromR === 7 && fromC === 0) next[1].q = false;
      if (piece === 'r' && fromR === 0 && fromC === 7) next[2].k = false;
      if (piece === 'r' && fromR === 0 && fromC === 0) next[2].q = false;
      return next;
    });

    if (captured || special === 'enpassant') {
      sounds.score();
      vibrate(15);
    } else {
      sounds.tap();
      vibrate(8);
    }

    clearInterval(timerRef.current);
    setTurn(t => t === 1 ? 2 : 1);
  }, [board]);

  const handleSquareClick = useCallback((row, col) => {
    if (gameOverRef.current) return;
    if (mode === '1p' && turn === 2) return;
    const piece = board[row][col];

    if (selected) {
      const move = legalMoves.find(m => m[0] === row && m[1] === col);
      if (move) {
        executeMove(selected[0], selected[1], row, col, move[2]);
        return;
      }
      if (piece && isPlayer(piece, turn)) {
        const moves = getLegalMoves(board, row, col, turn, enPassant, castling);
        setSelected([row, col]);
        setLegalMoves(moves);
        sounds.tap();
        return;
      }
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    if (piece && isPlayer(piece, turn)) {
      const moves = getLegalMoves(board, row, col, turn, enPassant, castling);
      setSelected([row, col]);
      setLegalMoves(moves);
      sounds.tap();
    }
  }, [selected, board, turn, legalMoves, enPassant, castling, mode, executeMove]);

  const inCheck = gameStatus === 'check';
  const kingPos = findKing(board, turn);
  const isBotTurn = mode === '1p' && turn === 2;
  const progress = timeLeft / TURN_TIME;
  const barColor = turn === 1 ? '#D4A855' : '#888888';
  const isUrgent = timeLeft <= 5 && !gameOverRef.current && !isBotTurn;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '10px',
      background: 'radial-gradient(ellipse at 30% 20%, #1e1810 0%, #0d0a07 60%, #050403 100%)',
      position: 'relative',
      overflow: 'hidden',
      gap: 5,
    }}>
      {/* Ambient orbs */}
      <div style={{
        position: 'absolute', top: '8%', left: '5%',
        width: 160, height: 160, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(181,136,99,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '12%', right: '8%',
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(109,76,46,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      {/* Captured pieces — Black (top) */}
      <div style={{
        display: 'flex', gap: 2, minHeight: 22, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 'min(92vw, 400px)',
      }}>
        {capturedBlack.map((p, i) => (
          <span key={i} style={{ fontSize: 15, opacity: 0.7, lineHeight: 1 }}>{PIECE_CHARS[p]}</span>
        ))}
      </div>

      {/* Turn / Status HUD */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 2,
      }}>
        {/* White indicator */}
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: turn === 1 && !gameOverRef.current ? 'rgba(181,136,99,0.2)' : 'rgba(255,255,255,0.04)',
          border: turn === 1 && !gameOverRef.current ? '2px solid rgba(181,136,99,0.6)' : '2px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s',
          boxShadow: turn === 1 && !gameOverRef.current ? '0 0 10px rgba(181,136,99,0.25)' : 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 45 45">
            <g fill="#FFFFFF" stroke="#555" strokeWidth="1.5">
              <circle cx="22.5" cy="12" r="5"/>
              <path d="M 17 25 L 28 25 L 27.5 20 C 27.5 18 22.5 17 22.5 17 C 22.5 17 17.5 18 17.5 20 Z"/>
              <path d="M 11 39 L 34 39 L 31 30 C 31 27 28 25 28 25 L 17 25 C 17 25 14 27 14 30 Z"/>
            </g>
          </svg>
        </div>

        {/* Status label */}
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: gameStatus === 'checkmate' ? '#EF4444'
            : gameStatus === 'stalemate' ? 'rgba(255,255,255,0.5)'
            : gameStatus === 'check' ? '#FFB830'
            : turn === 1 ? '#D4A855' : '#999',
          transition: 'color 0.3s',
          textShadow: gameStatus === 'check' ? '0 0 12px rgba(255,184,48,0.4)' : 'none',
        }}>
          {gameStatus === 'checkmate' ? 'CHECKMATE'
            : gameStatus === 'stalemate' ? 'STALEMATE'
            : gameStatus === 'check' ? 'CHECK!'
            : mode === '1p'
              ? (turn === 1 ? 'YOUR TURN' : 'BOT...')
              : `PLAYER ${turn}`}
        </div>

        {/* Black indicator */}
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: turn === 2 && !gameOverRef.current ? 'rgba(60,60,60,0.3)' : 'rgba(255,255,255,0.04)',
          border: turn === 2 && !gameOverRef.current ? '2px solid rgba(120,120,120,0.5)' : '2px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s',
          boxShadow: turn === 2 && !gameOverRef.current ? '0 0 10px rgba(120,120,120,0.2)' : 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 45 45">
            <g fill="#1a1a1a" stroke="#ccc" strokeWidth="1.5">
              <circle cx="22.5" cy="12" r="5"/>
              <path d="M 17 25 L 28 25 L 27.5 20 C 27.5 18 22.5 17 22.5 17 C 22.5 17 17.5 18 17.5 20 Z"/>
              <path d="M 11 39 L 34 39 L 31 30 C 31 27 28 25 28 25 L 17 25 C 17 25 14 27 14 30 Z"/>
            </g>
          </svg>
        </div>
      </div>

      {/* Timer Bar */}
      {!gameOverRef.current && (
        <div style={{
          width: 'min(90vw, 380px)', height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0,
            left: turn === 1 ? 0 : 'auto',
            right: turn === 2 ? 0 : 'auto',
            height: '100%',
            width: isBotTurn ? '100%' : `${progress * 100}%`,
            background: isBotTurn
              ? `repeating-linear-gradient(90deg, ${barColor}22 0px, ${barColor}22 6px, transparent 6px, transparent 12px)`
              : `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
            borderRadius: 2, transition: 'width 0.05s linear',
            boxShadow: isUrgent ? `0 0 10px ${barColor}` : `0 0 4px ${barColor}44`,
            animation: isUrgent ? 'timerPulse 0.5s ease-in-out infinite' : 'none',
          }} />
        </div>
      )}

      {/* Time text */}
      {!gameOverRef.current && !isBotTurn && (
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 10,
          color: isUrgent ? barColor : 'rgba(255,255,255,0.2)',
          letterSpacing: 1,
        }}>
          {Math.ceil(timeLeft)}s
        </div>
      )}

      {/* Chessboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        width: 'min(90vw, 380px)',
        aspectRatio: '1',
        borderRadius: 8,
        overflow: 'hidden',
        border: '3px solid #3D2B1F',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(181,136,99,0.15)',
      }}>
        {board.map((row, r) =>
          row.map((piece, c) => {
            const isLight = (r + c) % 2 === 0;
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const isLegalTarget = legalMoves.some(m => m[0] === r && m[1] === c);
            const isCapture = isLegalTarget && piece;
            const isLastFrom = lastMove && lastMove.from[0] === r && lastMove.from[1] === c;
            const isLastTo = lastMove && lastMove.to[0] === r && lastMove.to[1] === c;
            const isKingInCheck = inCheck && kingPos && kingPos[0] === r && kingPos[1] === c;

            let bg = isLight ? BOARD.light : BOARD.dark;
            if (isSelected) bg = isLight ? BOARD.selectedLight : BOARD.selectedDark;
            else if (isLastFrom || isLastTo) bg = isLight ? BOARD.lastMoveLight : BOARD.lastMoveDark;
            if (isKingInCheck) bg = BOARD.checkBg;

            return (
              <button
                key={`${r}-${c}`}
                id={`sq-${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                className="chess-square"
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: bg,
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: 0,
                  transition: 'background 0.15s',
                }}
              >
                {/* Legal move dot */}
                {isLegalTarget && !isCapture && (
                  <div style={{
                    position: 'absolute',
                    width: '30%', height: '30%',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.25)',
                    zIndex: 3,
                  }} />
                )}

                {/* Capture ring */}
                {isCapture && (
                  <div style={{
                    position: 'absolute', inset: '4%',
                    borderRadius: '50%',
                    border: '3.5px solid rgba(0,0,0,0.25)',
                    zIndex: 3,
                  }} />
                )}

                {/* Piece */}
                {piece && (
                  <div style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.12s',
                  }}>
                    <PieceSVG piece={piece} />
                  </div>
                )}

                {/* Rank labels (left column) */}
                {c === 0 && (
                  <span style={{
                    position: 'absolute', top: 2, left: 3,
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: isLight ? BOARD.labelLight : BOARD.labelDark,
                    pointerEvents: 'none', zIndex: 4,
                  }}>{8 - r}</span>
                )}
                {/* File labels (bottom row) */}
                {r === 7 && (
                  <span style={{
                    position: 'absolute', bottom: 1, right: 3,
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: isLight ? BOARD.labelLight : BOARD.labelDark,
                    pointerEvents: 'none', zIndex: 4,
                  }}>{'abcdefgh'[c]}</span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Captured pieces — White (bottom) */}
      <div style={{
        display: 'flex', gap: 2, minHeight: 22, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 'min(92vw, 400px)',
      }}>
        {capturedWhite.map((p, i) => (
          <span key={i} style={{ fontSize: 15, opacity: 0.7, lineHeight: 1 }}>{PIECE_CHARS[p]}</span>
        ))}
      </div>

      {/* Move count */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.12)',
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        Move {moveCount}
      </div>

      <style jsx>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .chess-square:hover {
          filter: brightness(1.12);
        }
        .chess-square:active {
          filter: brightness(0.92);
        }
      `}</style>
    </div>
  );
}
