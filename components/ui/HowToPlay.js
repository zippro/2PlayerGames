'use client';

import { useState } from 'react';
import Image from 'next/image';
import { sounds } from '@/lib/sounds';

export default function HowToPlay({ game, onClose }) {
  const steps = game.howToPlay || [];

  if (!steps.length) {
    onClose();
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{
        background: 'rgba(30, 35, 50, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        maxWidth: 360,
        width: '100%',
        padding: 0,
        overflow: 'hidden',
        animation: 'slideUp 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Game image header */}
        <div style={{
          position: 'relative',
          height: 160,
          overflow: 'hidden',
        }}>
          <Image
            src={`/images/cards/${game.id}.png`}
            alt={game.name}
            fill
            style={{ objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 30%, rgba(30,35,50,0.95) 100%)',
          }} />
          <h2 style={{
            position: 'absolute',
            bottom: 12,
            left: 20,
            right: 20,
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: '#fff',
            margin: 0,
          }}>
            How to Play
          </h2>
        </div>

        {/* Steps */}
        <div style={{ padding: '16px 20px 8px' }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              marginBottom: 14,
            }}>
              {/* Step number circle */}
              <div style={{
                minWidth: 28,
                height: 28,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                color: '#fff',
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <p style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.7)',
              }}>
                {step}
              </p>
            </div>
          ))}
        </div>

        {/* Got it button */}
        <div style={{ padding: '8px 20px 20px' }}>
          <button
            onClick={() => { sounds.tap(); onClose(); }}
            id="btn-htp-ok"
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 14,
              border: 'none',
              background: `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})`,
              color: '#fff',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'transform 150ms ease',
            }}
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
