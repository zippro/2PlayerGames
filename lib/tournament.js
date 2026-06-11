'use client';

import { createContext, useContext, useReducer, useCallback } from 'react';

const TournamentContext = createContext(null);

const initialState = {
  active: false,
  p1Score: 0,
  p2Score: 0,
  targetScore: 5,
  gamesPlayed: [],
  currentGame: null,
};

function tournamentReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...initialState, active: true, targetScore: action.payload || 5 };
    case 'GAME_WON':
      const newState = {
        ...state,
        gamesPlayed: [...state.gamesPlayed, { game: action.payload.game, winner: action.payload.winner }],
      };
      if (action.payload.winner === 1) newState.p1Score = state.p1Score + 1;
      if (action.payload.winner === 2) newState.p2Score = state.p2Score + 1;
      return newState;
    case 'SET_CURRENT_GAME':
      return { ...state, currentGame: action.payload };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

export function TournamentProvider({ children }) {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);

  const startTournament = useCallback((targetScore = 5) => {
    dispatch({ type: 'START', payload: targetScore });
  }, []);

  const gameWon = useCallback((game, winner) => {
    dispatch({ type: 'GAME_WON', payload: { game, winner } });
  }, []);

  const resetTournament = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <TournamentContext.Provider value={{ ...state, startTournament, gameWon, resetTournament, dispatch }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}
