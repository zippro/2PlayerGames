'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/lib/tournament';
import { GAMES } from '@/lib/gameRegistry';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TournamentPage() {
  const router = useRouter();
  const { active, p1Score, p2Score, startTournament, resetTournament, gameWon } = useTournament();
  const [targetScore, setTargetScore] = useState(5);
  const [gameQueue, setGameQueue] = useState([]);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);

  const startNewTournament = useCallback(() => {
    startTournament(targetScore);
    const shuffled = shuffleArray(GAMES.filter(g => g.modes.includes('2p')));
    setGameQueue(shuffled);
    setCurrentGameIndex(0);
  }, [targetScore, startTournament]);

  const playNextGame = useCallback(() => {
    if (gameQueue.length === 0) return;
    const nextGame = gameQueue[currentGameIndex % gameQueue.length];
    router.push(`/games/${nextGame.id}?mode=2p&tournament=true`);
  }, [gameQueue, currentGameIndex, router]);

  const winner = p1Score >= targetScore ? 1 : p2Score >= targetScore ? 2 : null;

  // Not started state
  if (!active) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-primary)',
        gap: 24,
      }}>
        <div style={{ fontSize: 80 }}>🏆</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          textAlign: 'center',
          textTransform: 'uppercase',
        }}>
          Tournament Mode
        </h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 300 }}>
          Compete across multiple games! Win individual games to score points. First to reach the target wins the tournament!
        </p>

        {/* Target score selector */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 320,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
            TARGET SCORE
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[3, 5, 7].map(n => (
              <button
                key={n}
                onClick={() => setTargetScore(n)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: 'none',
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  cursor: 'pointer',
                  background: targetScore === n ? 'var(--accent-yellow)' : 'var(--bg-secondary)',
                  color: '#fff',
                  transition: 'all 0.2s',
                  boxShadow: targetScore === n ? '0 4px 0 var(--accent-yellow-dark)' : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          className="play-btn"
          onClick={startNewTournament}
          style={{ maxWidth: 320, width: '100%' }}
        >
          START TOURNAMENT
        </button>

        <button className="back-link" onClick={() => router.push('/')}>
          <span>‹</span> Back to Games
        </button>
      </div>
    );
  }

  // Tournament winner
  if (winner) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-primary)',
        gap: 20,
      }}>
        <div style={{ fontSize: 80, animation: 'bounce 0.6s ease infinite alternate' }}>🏆</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          color: winner === 1 ? 'var(--p1-color)' : 'var(--p2-color)',
          textTransform: 'uppercase',
        }}>
          Player {winner} Wins!
        </h1>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          display: 'flex',
          gap: 16,
        }}>
          <span style={{ color: 'var(--p1-color)' }}>{p1Score}</span>
          <span style={{ color: 'var(--text-muted)' }}>-</span>
          <span style={{ color: 'var(--p2-color)' }}>{p2Score}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320, marginTop: 16 }}>
          <button className="btn-play-again" onClick={() => { resetTournament(); startNewTournament(); }}>
            New Tournament
          </button>
          <button className="btn-back-menu" onClick={() => { resetTournament(); router.push('/'); }}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // Active tournament
  const nextGame = gameQueue.length > 0 ? gameQueue[currentGameIndex % gameQueue.length] : null;

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 24,
      background: 'var(--bg-primary)',
      gap: 20,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        justifyContent: 'space-between',
      }}>
        <button className="header-btn" onClick={() => router.push('/')}>‹</button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, textTransform: 'uppercase' }}>
          🏆 Tournament
        </h1>
        <div style={{ width: 44 }} />
      </div>

      {/* Score */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 320,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>
          FIRST TO {targetScore}
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}>
          <span style={{ color: 'var(--p1-color)' }}>{p1Score}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 24 }}>vs</span>
          <span style={{ color: 'var(--p2-color)' }}>{p2Score}</span>
        </div>
      </div>

      {/* Next game */}
      {nextGame && (
        <div style={{
          background: nextGame.gradient,
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 320,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: 700 }}>
            NEXT GAME
          </div>
          <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", position: "relative", marginBottom: 8 }}><img src={`/images/cards/${nextGame.id}.png`} alt={nextGame.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{nextGame.name}</div>
        </div>
      )}

      <button
        className="play-btn"
        onClick={playNextGame}
        style={{ maxWidth: 320, width: '100%' }}
      >
        PLAY
      </button>

      <button
        className="back-link"
        onClick={() => { resetTournament(); router.push('/'); }}
        style={{ marginTop: 'auto' }}
      >
        Cancel Tournament
      </button>
    </div>
  );
}
