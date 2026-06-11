'use client';

import { sounds, vibrate } from '@/lib/sounds';

// SVG icons
const StarIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const RobotIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
    <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/>
  </svg>
);

const HandshakeIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
    <path d="M12.22 19.85c-.18.18-.5.21-.71 0L3.2 11.54c-.39-.39-.39-1.02 0-1.41l1.41-1.41 3.54 3.54c.78.78 2.05.78 2.83 0l2.83-2.83 3.54 3.54-5.13 5.13 .01.01-.01-.01v-.25zm7.78-7.78l-1.41 1.41-3.54-3.54c-.78-.78-2.05-.78-2.83 0L9.39 12.77 5.85 9.23l5.13-5.13c.2-.2.51-.2.71 0l8.31 8.31c.39.39.39 1.02 0 1.41v.25z"/>
  </svg>
);

export default function GameOverModal({ winner, onPlayAgain, onBackToMenu, mode }) {
  const isP1 = winner === 1;
  const isDraw = winner === 'draw';

  let title, Icon, colorClass, gradient, accentColor;
  if (isDraw) {
    title = "It's a Draw!";
    Icon = HandshakeIcon;
    colorClass = 'draw';
    gradient = 'linear-gradient(135deg, #FFB830, #F59E0B)';
    accentColor = '#FFB830';
  } else if (mode === '1p') {
    if (isP1) {
      title = 'You Win!';
      Icon = StarIcon;
      colorClass = 'p1';
      gradient = 'linear-gradient(135deg, #FF6B6B, #E55A5A)';
      accentColor = '#FF6B6B';
    } else {
      title = 'Bot Wins!';
      Icon = RobotIcon;
      colorClass = 'p2';
      gradient = 'linear-gradient(135deg, #4ECDC4, #3DBDB5)';
      accentColor = '#4ECDC4';
    }
  } else {
    title = `Player ${winner} Wins!`;
    Icon = StarIcon;
    colorClass = isP1 ? 'p1' : 'p2';
    gradient = isP1
      ? 'linear-gradient(135deg, #FF6B6B, #E55A5A)'
      : 'linear-gradient(135deg, #4ECDC4, #3DBDB5)';
    accentColor = isP1 ? '#FF6B6B' : '#4ECDC4';
  }

  return (
    <div className="game-over-overlay">
      <div className="game-over-card" style={{
        background: 'rgba(20, 25, 40, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 28,
      }}>
        {/* Accent strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          borderRadius: '28px 28px 0 0',
          background: gradient,
        }} />

        {/* Icon */}
        <div style={{
          marginTop: 8,
          marginBottom: 12,
          color: accentColor,
          animation: 'bounce 0.6s ease infinite alternate',
        }}>
          <Icon />
        </div>

        <h2 className={`game-over-title ${colorClass}`} style={{ fontSize: 28 }}>{title}</h2>
        <p className="game-over-subtitle" style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.45)',
        }}>
          {isDraw ? 'Great match! Try again?' : 'Incredible game! Play again?'}
        </p>
        <div className="game-over-actions" style={{ gap: 12, marginTop: 8 }}>
          <button
            className="btn-play-again"
            onClick={() => { sounds.tap(); vibrate(20); onPlayAgain(); }}
            id="btn-play-again"
            style={{
              background: 'linear-gradient(135deg, #4ADE80, #22C55E)',
              boxShadow: '0 4px 0 #16A34A, 0 6px 16px rgba(34, 197, 94, 0.25)',
              borderRadius: 14,
              fontSize: 16,
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Play Again
          </button>
          <button
            className="btn-back-menu"
            onClick={() => { sounds.tap(); onBackToMenu(); }}
            id="btn-back-menu"
            style={{
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              padding: '12px 24px',
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
