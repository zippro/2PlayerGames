'use client';

import { useState, useCallback } from 'react';
import { getDifficultyByValue } from '@/lib/gameRegistry';
import Image from 'next/image';
import { sounds } from '@/lib/sounds';

// Bot face SVG — changes expression based on difficulty
const BotFace = ({ level }) => {
  // 0=easy, 1=normal, 2=hard
  const mouthPath = level === 0
    ? 'M8 14c0 0 2 3 4 3s4-3 4-3' // smile
    : level === 1
    ? 'M8 16h8' // neutral
    : 'M8 18c0 0 2-3 4-3s4 3 4 3'; // frown/angry

  const eyeSize = level === 2 ? 2.5 : 2;
  const browOffset = level === 2 ? -2 : 0;

  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <rect x="3" y="4" width="18" height="16" rx="4" fill="currentColor" opacity="0.15"/>
      {/* Antenna */}
      <line x1="12" y1="1" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="1" r="1.5" fill="currentColor"/>
      {/* Eyes */}
      <circle cx="9" cy="11" r={eyeSize} fill="currentColor"/>
      <circle cx="15" cy="11" r={eyeSize} fill="currentColor"/>
      {/* Brows (only for hard) */}
      {level === 2 && (
        <>
          <line x1="7" y1="8" x2="10.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="17" y1="8" x2="13.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </>
      )}
      {/* Mouth */}
      <path d={mouthPath} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
};

export default function DifficultySelector({ onPlay, onBack, gameName, gameId }) {
  const [sliderValue, setSliderValue] = useState(0.5);
  const difficulty = getDifficultyByValue(sliderValue);

  const handleSliderChange = useCallback((e) => {
    setSliderValue(parseFloat(e.target.value));
    sounds.slide();
  }, []);

  const colors = {
    easy: '#4ADE80',
    normal: '#FFB830',
    hard: '#EF4444',
  };

  const accentColor = colors[difficulty.id] || colors.normal;

  return (
    <div className="difficulty-screen">
      {/* Game preview image behind */}
      {gameId && (
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          overflow: 'hidden',
          position: 'relative',
          marginBottom: -16,
          zIndex: 2,
          border: `3px solid ${accentColor}`,
          boxShadow: `0 4px 16px ${accentColor}44`,
        }}>
          <Image
            src={`/images/cards/${gameId}.png`}
            alt={gameName}
            fill
            style={{ objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Bot face */}
      <div style={{
        width: 90,
        height: 90,
        borderRadius: '50%',
        background: accentColor,
        border: '4px solid #fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        marginBottom: -20,
        zIndex: 3,
        boxShadow: `0 6px 20px ${accentColor}55`,
        transition: 'background 300ms ease, box-shadow 300ms ease',
      }}>
        <BotFace level={difficulty.value} />
      </div>

      <div className="difficulty-card" style={{
        background: 'rgba(30, 35, 50, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 24,
      }}>
        <h2 className="difficulty-label" style={{
          color: accentColor,
          transition: 'color 300ms ease',
        }}>
          {difficulty.label}
        </h2>
        
        <div className="difficulty-slider-container">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sliderValue}
            onChange={handleSliderChange}
            className="difficulty-slider"
            style={{ '--slider-pct': `${sliderValue * 100}%` }}
            id="difficulty-slider"
            aria-label="Difficulty level"
          />
          <p className="difficulty-hint" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Drag to adjust difficulty
          </p>
        </div>

        <button
          className="play-btn"
          onClick={() => { sounds.go(); onPlay(difficulty); }}
          id="btn-play"
          style={{
            background: accentColor,
            boxShadow: `0 4px 0 ${accentColor}99`,
            transition: 'background 300ms ease',
          }}
        >
          PLAY
        </button>
      </div>
      
      <button className="back-link" onClick={() => { sounds.tap(); onBack(); }} id="btn-back-difficulty">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>
    </div>
  );
}
