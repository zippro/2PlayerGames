'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/ui/Header';
import TabSwitch from '@/components/ui/TabSwitch';
import GameCard from '@/components/ui/GameCard';
import TournamentBar from '@/components/ui/TournamentBar';
import { GAMES, getGamesByMode } from '@/lib/gameRegistry';

export default function HomePage() {
  const [tab, setTab] = useState('2p');
  const router = useRouter();

  const filteredGames = getGamesByMode(tab);

  const handleGameClick = useCallback((game) => {
    if (tab === '1p') {
      router.push(`/games/${game.id}?mode=1p`);
    } else {
      router.push(`/games/${game.id}?mode=2p`);
    }
  }, [tab, router]);

  const handleTournament = useCallback(() => {
    router.push('/tournament');
  }, [router]);

  const handleSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  return (
    <>
      <Header onSettingsClick={handleSettings} />
      <TabSwitch activeTab={tab} onTabChange={setTab} />
      
      <div className="game-grid">
        {filteredGames.map((game, index) => (
          <GameCard
            key={game.id}
            game={game}
            index={index}
            onClick={() => handleGameClick(game)}
          />
        ))}
      </div>

      <TournamentBar onTournamentClick={handleTournament} />
    </>
  );
}
