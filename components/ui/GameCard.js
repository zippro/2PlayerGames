'use client';

import Image from 'next/image';

export default function GameCard({ game, onClick, index }) {
  return (
    <div
      className="game-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      id={`game-card-${game.id}`}
      style={{
        animationDelay: `${index * 80}ms`,
      }}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Card image */}
      <div className="game-card-image">
        <Image
          src={`/images/cards/${game.id}.png`}
          alt={game.name}
          fill
          sizes="(max-width: 768px) 45vw, 220px"
          style={{ objectFit: 'cover' }}
          priority={index < 4}
        />
        {/* Gradient overlay for text readability */}
        <div className="game-card-overlay" />
      </div>

      {/* Game name */}
      <div className="game-card-name">{game.name}</div>

      {/* Badge */}
      {game.badge && (
        <div className="game-card-badge">{game.badge}</div>
      )}
    </div>
  );
}
