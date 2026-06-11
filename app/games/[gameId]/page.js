'use client';

import { useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getGameById } from '@/lib/gameRegistry';
import DifficultySelector from '@/components/ui/DifficultySelector';
import HowToPlay from '@/components/ui/HowToPlay';
import GameOverModal from '@/components/ui/GameOverModal';
import { analytics } from '@/lib/analytics';
import { sounds, vibrate, initAudio } from '@/lib/sounds';

import dynamic from 'next/dynamic';

const gameComponents = {
  'ping-pong': dynamic(() => import('@/components/games/PingPong'), { ssr: false }),
  'tic-tac-toe': dynamic(() => import('@/components/games/TicTacToe'), { ssr: false }),
  'sea-battle': dynamic(() => import('@/components/games/SeaBattle'), { ssr: false }),
  'memory-match': dynamic(() => import('@/components/games/MemoryMatch'), { ssr: false }),
  'knife-throw': dynamic(() => import('@/components/games/KnifeThrow'), { ssr: false }),
  'spin-war': dynamic(() => import('@/components/games/SpinWar'), { ssr: false }),
  'soccer-pool': dynamic(() => import('@/components/games/SoccerPool'), { ssr: false }),
  'backgammon': dynamic(() => import('@/components/games/Backgammon'), { ssr: false }),
  'darts': dynamic(() => import('@/components/games/Darts'), { ssr: false }),
  'slot-cars': dynamic(() => import('@/components/games/SlotCars'), { ssr: false }),
  'archery': dynamic(() => import('@/components/games/Archery'), { ssr: false }),
  'tennis': dynamic(() => import('@/components/games/Tennis'), { ssr: false }),
};

function GamePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = params.gameId;
  const mode = searchParams.get('mode') || '2p';
  const game = getGameById(gameId);

  // Flow: difficulty (1p) → tutorial → playing → gameover
  // Tutorial shown at start, user taps "GOT IT" to play
  const [phase, setPhase] = useState(mode === '1p' ? 'difficulty' : 'tutorial');
  const [difficulty, setDifficulty] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const handleDifficultyPlay = useCallback((diff) => {
    setDifficulty(diff);
    setPhase('tutorial'); // Show tutorial after difficulty
    sounds.tap();
  }, []);

  const handleTutorialClose = useCallback(() => {
    initAudio(); // Init audio on user interaction
    setPhase('playing');
    sounds.go();
    analytics.gameStart(gameId, mode, difficulty?.id);
  }, [gameId, mode, difficulty]);

  const handleGameEnd = useCallback((winner, duration) => {
    analytics.gameEnd(gameId, mode, winner, duration, difficulty?.id);
    setGameResult({ winner, duration });
    setPhase('gameover');
    if (winner === 1 || (mode === '2p' && winner === 2)) {
      sounds.win();
      vibrate([50, 30, 50]);
    } else {
      sounds.lose();
    }
  }, [gameId, mode, difficulty]);

  const handlePlayAgain = useCallback(() => {
    setGameResult(null);
    setGameKey(k => k + 1);
    setPhase('playing');
    sounds.tap();
    analytics.gameStart(gameId, mode, difficulty?.id);
  }, [gameId, mode, difficulty]);

  const handleBackToMenu = useCallback(() => {
    sounds.tap();
    router.push('/');
  }, [router]);

  const handleExit = useCallback(() => {
    sounds.tap();
    router.push('/');
  }, [router]);

  if (!game) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-primary)', minHeight: '100dvh' }}>
        <h2>Game not found</h2>
        <button onClick={handleBackToMenu} className="back-link">Back to Menu</button>
      </div>
    );
  }

  // Difficulty selector (1p only)
  if (phase === 'difficulty') {
    return (
      <DifficultySelector
        gameName={game.name}
        gameId={game.id}
        onPlay={handleDifficultyPlay}
        onBack={handleBackToMenu}
      />
    );
  }

  // Tutorial shown at start — one tap to start playing
  if (phase === 'tutorial') {
    return (
      <div style={{ height: '100dvh', background: 'var(--bg-primary)' }}>
        <HowToPlay game={game} onClose={handleTutorialClose} />
      </div>
    );
  }

  const GameComponent = gameComponents[gameId];

  return (
    <>
      <div className="game-screen">
        {/* Top bar */}
        <div className="game-top-bar" style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            letterSpacing: 1,
          }}>
            {game.name}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Help button */}
            <button
              onClick={() => { sounds.tap(); setShowHelp(true); }}
              id="btn-help"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="How to Play"
            >
              ?
            </button>

            <button className="exit-btn" onClick={handleExit} id="btn-exit" style={{
              background: 'rgba(255,70,70,0.7)',
              borderRadius: 10,
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.5,
            }}>
              EXIT
            </button>
          </div>
        </div>

        {/* Game area */}
        <div className="game-canvas-area">
          {GameComponent && (
            <GameComponent
              key={gameKey}
              mode={mode}
              difficulty={difficulty}
              onGameEnd={handleGameEnd}
            />
          )}
        </div>
      </div>

      {/* How to Play overlay */}
      {showHelp && (
        <HowToPlay game={game} onClose={() => setShowHelp(false)} />
      )}

      {/* Game Over */}
      {phase === 'gameover' && gameResult && (
        <GameOverModal
          winner={gameResult.winner === 'bot' ? 2 : gameResult.winner}
          mode={mode}
          onPlayAgain={handlePlayAgain}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        background: 'var(--bg-primary)',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 2,
      }}>
        LOADING...
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
}
