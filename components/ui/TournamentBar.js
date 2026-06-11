'use client';

import { useTournament } from '@/lib/tournament';
import { sounds } from '@/lib/sounds';

// SVG trophy icon
const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
  </svg>
);

// SVG person icon
const PersonIcon = ({ color }) => (
  <div style={{
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 10px ${color}55`,
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  </div>
);

export default function TournamentBar({ onTournamentClick }) {
  const { p1Score, p2Score, active } = useTournament();

  return (
    <div className="tournament-bar" style={{
      background: 'rgba(20, 25, 40, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="tournament-score p1">
        <PersonIcon color="#FF6B6B" />
        <span className="tournament-score-num">{p1Score}</span>
      </div>
      
      <div
        className="tournament-center"
        onClick={() => { sounds.tap(); onTournamentClick(); }}
        id="btn-tournament"
        style={{
          background: 'linear-gradient(135deg, #FFB830, #F59E0B)',
          boxShadow: '0 4px 0 #D97706, 0 6px 16px rgba(245, 158, 11, 0.25)',
          borderRadius: 14,
          padding: '10px 18px',
        }}
      >
        <TrophyIcon />
        <span className="tournament-center-text" style={{ fontSize: 11, letterSpacing: 1.5 }}>
          {active ? 'TOURNAMENT' : 'PLAY TOURNAMENT'}
        </span>
        <TrophyIcon />
      </div>
      
      <div className="tournament-score p2" style={{ flexDirection: 'row-reverse' }}>
        <PersonIcon color="#4ECDC4" />
        <span className="tournament-score-num">{p2Score}</span>
      </div>
    </div>
  );
}
