'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sounds, vibrate } from '@/lib/sounds';
import { Particles } from '@/lib/gameRenderer';

// SVG symbol shapes instead of emojis
const SYMBOLS = [
  { id: 'star', color: '#FFD700', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z' },
  { id: 'heart', color: '#FF6B6B', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  { id: 'diamond', color: '#4ECDC4', path: 'M12 2L2 12l10 10 10-10L12 2z' },
  { id: 'moon', color: '#9B59B6', path: 'M12.43 2.3c-2.38-.59-4.68-.27-6.63.64-.35.16-.41.64-.1.86C8.3 5.6 9.67 8.5 9.67 11.7c0 3.2-1.37 6.1-3.97 7.9-.31.22-.25.7.1.86 1.95.91 4.25 1.23 6.63.64 4.54-1.13 7.5-5.48 7.07-10.14-.43-4.66-3.53-7.53-7.07-8.66z' },
  { id: 'bolt', color: '#F59E0B', path: 'M7 2v11h3v9l7-12h-4l4-8H7z' },
  { id: 'drop', color: '#3498DB', path: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z' },
  { id: 'leaf', color: '#27ae60', path: 'M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z' },
  { id: 'sun', color: '#E67E22', path: 'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z' },
];

const GRID_COLS = 4;
const TURN_TIME = 8; // seconds

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createCards() {
  const pairs = [...SYMBOLS, ...SYMBOLS];
  return shuffleArray(pairs).map((symbol, i) => ({
    id: i,
    symbol,
    flipped: false,
    matched: false,
  }));
}

const SymbolIcon = ({ symbol, size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={symbol.color} style={{ filter: `drop-shadow(0 0 8px ${symbol.color}66)` }}>
    <path d={symbol.path}/>
  </svg>
);

export default function MemoryMatch({ mode, difficulty, onGameEnd }) {
  const [cards, setCards] = useState(createCards);
  const [flipped, setFlipped] = useState([]);
  const [turn, setTurn] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  
  const startTimeRef = useRef(Date.now());
  const turnStartRef = useRef(Date.now());
  const timerRef = useRef(null);
  const botMemoryRef = useRef({});
  const canvasRef = useRef(null);
  const particlesRef = useRef(new Particles());

  const totalPairs = SYMBOLS.length;

  // Turn Timer
  useEffect(() => {
    turnStartRef.current = Date.now();
    setTimeLeft(TURN_TIME);

    if (locked) return;
    
    const isBotTurn = mode === '1p' && turn === 2;
    if (isBotTurn) return; // Hide timer behavior for bot turns

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - turnStartRef.current) / 1000;
      const remaining = Math.max(0, TURN_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        // Time's up — skip turn
        sounds.miss();
        vibrate(15);
        
        setCards(prev => prev.map(c => 
          flipped.includes(c.id) ? { ...c, flipped: false } : c
        ));
        setFlipped([]);
        setTurn(t => t === 1 ? 2 : 1);
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [turn, flipped.length, locked, mode]);

  // Particles animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.update();
      particlesRef.current.draw(ctx);
      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleFlip = useCallback((cardId) => {
    if (locked) return;
    if (mode === '1p' && turn === 2) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return;
    if (flipped.includes(cardId)) return;

    sounds.tap();
    vibrate(8);

    const newFlipped = [...flipped, cardId];
    const newCards = cards.map(c => c.id === cardId ? { ...c, flipped: true } : c);
    setCards(newCards);
    setFlipped(newFlipped);

    // Bot memory
    if (mode === '1p') {
      const mem = botMemoryRef.current;
      if (!mem[card.symbol.id]) mem[card.symbol.id] = [];
      if (!mem[card.symbol.id].includes(cardId)) mem[card.symbol.id].push(cardId);
    }

    if (newFlipped.length === 2) {
      setLocked(true);
      const [id1, id2] = newFlipped;
      const card1 = newCards.find(c => c.id === id1);
      const card2 = newCards.find(c => c.id === id2);

      if (card1.symbol.id === card2.symbol.id) {
        // Match!
        sounds.pop();
        vibrate([15, 10, 15]);
        
        // Emit particles
        const el1 = document.getElementById(`card-${id1}`);
        const el2 = document.getElementById(`card-${id2}`);
        if (el1 && el2) {
          const r1 = el1.getBoundingClientRect();
          const r2 = el2.getBoundingClientRect();
          const canvasRect = canvasRef.current.getBoundingClientRect();
          particlesRef.current.emit(r1.left + r1.width/2 - canvasRect.left, r1.top + r1.height/2 - canvasRect.top, card1.symbol.color, 12);
          particlesRef.current.emit(r2.left + r2.width/2 - canvasRect.left, r2.top + r2.height/2 - canvasRect.top, card2.symbol.color, 12);
        }

        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === id1 || c.id === id2 ? { ...c, matched: true } : c
          ));
          const newScores = { ...scores };
          if (turn === 1) newScores.p1++;
          else newScores.p2++;
          setScores(newScores);
          sounds.score();
          setFlipped([]);
          setLocked(false);

          if (newScores.p1 + newScores.p2 >= totalPairs) {
            const winner = newScores.p1 > newScores.p2 ? 1 
              : newScores.p2 > newScores.p1 ? (mode === '1p' ? 'bot' : 2) 
              : 'draw';
            setTimeout(() => {
              onGameEnd(winner, Math.round((Date.now() - startTimeRef.current) / 1000));
            }, 500);
          }
        }, 600);
      } else {
        // No match
        sounds.miss();
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === id1 || c.id === id2 ? { ...c, flipped: false } : c
          ));
          setFlipped([]);
          setLocked(false);
          setTurn(t => t === 1 ? 2 : 1);
        }, 1000);
      }
    }
  }, [cards, flipped, locked, turn, scores, mode, totalPairs, onGameEnd]);

  // Bot turn
  useEffect(() => {
    if (mode !== '1p' || turn !== 2 || locked) return;
    
    const timer = setTimeout(() => {
      const mem = botMemoryRef.current;
      const diffId = difficulty?.id || 'normal';
      const forgetChance = diffId === 'easy' ? 0.7 : diffId === 'normal' ? 0.4 : 0.1;

      const available = cards.filter(c => !c.flipped && !c.matched);
      if (available.length < 2) return;

      let pick1, pick2;

      if (Math.random() > forgetChance) {
        for (const [symbolId, ids] of Object.entries(mem)) {
          const validIds = ids.filter(id => {
            const c = cards.find(card => card.id === id);
            return c && !c.matched && !c.flipped;
          });
          if (validIds.length >= 2) {
            pick1 = validIds[0];
            pick2 = validIds[1];
            break;
          }
        }
      }

      if (pick1 === undefined) {
        const shuffled = shuffleArray(available);
        pick1 = shuffled[0].id;
        pick2 = shuffled[1].id;
      }

      handleFlip(pick1);
      setTimeout(() => handleFlip(pick2), 600);
    }, 500 + Math.random() * 500);

    return () => clearTimeout(timer);
  }, [turn, mode, locked, cards, difficulty, handleFlip]);

  const progress = timeLeft / TURN_TIME;
  const isBotTurn = mode === '1p' && turn === 2;
  const barColor = turn === 1 ? '#FF6B6B' : '#4ECDC4';
  const isUrgent = timeLeft <= 3 && !isBotTurn;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 16,
      background: 'radial-gradient(ellipse at 50% 30%, #161b2e 0%, #0d1117 70%, #080a0f 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Particle Canvas */}
      <canvas 
        ref={canvasRef} 
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
      />

      {/* HUD Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        zIndex: 5,
      }}>
        {/* Turn HUD */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}>
          {/* P1 Score Node */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            borderRadius: 12,
            background: turn === 1 ? 'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.03)',
            border: turn === 1 ? '1px solid rgba(255,107,107,0.5)' : '1px solid rgba(255,255,255,0.05)',
            boxShadow: turn === 1 ? '0 0 16px rgba(255,107,107,0.2)' : 'none',
            transition: 'all 0.3s',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF6B6B"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#FF6B6B' }}>{scores.p1}</span>
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: 2,
          }}>VS</div>

          {/* P2 Score Node */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            borderRadius: 12,
            background: turn === 2 ? 'rgba(78,205,196,0.15)' : 'rgba(255,255,255,0.03)',
            border: turn === 2 ? '1px solid rgba(78,205,196,0.5)' : '1px solid rgba(255,255,255,0.05)',
            boxShadow: turn === 2 ? '0 0 16px rgba(78,205,196,0.2)' : 'none',
            transition: 'all 0.3s',
          }}>
            {mode === '1p' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#4ECDC4"><path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3z"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#4ECDC4"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            )}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#4ECDC4' }}>{scores.p2}</span>
          </div>
        </div>

        {/* Timer Bar */}
        <div style={{
          width: 'min(80vw, 300px)',
          height: 6,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0,
            left: turn === 1 ? 0 : 'auto',
            right: turn === 2 ? 0 : 'auto',
            height: '100%',
            width: isBotTurn ? '100%' : (progress * 100) + '%',
            background: isBotTurn
              ? 'repeating-linear-gradient(90deg, ' + barColor + '22 0px, ' + barColor + '22 6px, transparent 6px, transparent 12px)'
              : 'linear-gradient(90deg, ' + barColor + ', ' + barColor + 'cc)',
            borderRadius: 3,
            transition: 'width 0.05s linear',
            boxShadow: isUrgent ? '0 0 10px ' + barColor : '0 0 4px ' + barColor + '44',
            animation: isUrgent ? 'timerPulse 0.5s ease-in-out infinite' : 'none',
          }} />
        </div>
      </div>

      {/* Card Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(' + GRID_COLS + ', 1fr)',
        gap: 12,
        width: 'min(90vw, 400px)',
        perspective: '1000px',
        zIndex: 5,
      }}>
        {cards.map(card => {
          const isFlipped = card.flipped || card.matched;
          return (
            <button
              key={card.id}
              id={'card-' + card.id}
              onClick={() => handleFlip(card.id)}
              className="memory-card"
              style={{
                aspectRatio: '1',
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: isFlipped ? 'default' : 'pointer',
                outline: 'none',
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Card Back */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                }} className="card-face-back">
                  <div style={{
                    width: '50%', height: '50%',
                    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 4px, transparent 4px, transparent 8px)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ width: '40%', height: '40%', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                </div>

                {/* Card Front */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: card.matched ? card.symbol.color + '15' : 'rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  border: card.matched ? '2px solid ' + card.symbol.color + '66' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: card.matched ? '0 0 20px ' + card.symbol.color + '33, inset 0 0 15px ' + card.symbol.color + '22' : '0 8px 16px rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: card.matched ? 0.6 : 1,
                }}>
                  <SymbolIcon symbol={card.symbol} size={Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.1 : 36, 42)} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .memory-card:hover .card-face-back {
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .memory-card:active .card-face-back {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
}
