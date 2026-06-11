// Analytics tracking utility
// Sends events to the backend for the admin dashboard

const ANALYTICS_KEY = '2pg_analytics';
const SESSION_KEY = '2pg_session';

// Generate a simple session ID
function getSessionId() {
  if (typeof window === 'undefined') return null;
  let session = sessionStorage.getItem(SESSION_KEY);
  if (!session) {
    session = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, session);
  }
  return session;
}

// Get or create a persistent user ID (anonymous)
function getUserId() {
  if (typeof window === 'undefined') return null;
  let userId = localStorage.getItem('2pg_user_id');
  if (!userId) {
    userId = `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('2pg_user_id', userId);
  }
  return userId;
}

// Store event locally (and optionally send to API)
function storeEvent(event) {
  if (typeof window === 'undefined') return;
  
  const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  events.push(event);
  
  // Keep only last 1000 events locally
  if (events.length > 1000) {
    events.splice(0, events.length - 1000);
  }
  
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  
  // TODO: Send to Supabase API when backend is configured
  // sendToBackend(event);
}

export const analytics = {
  // Track a game being started
  gameStart(gameId, mode, difficulty = null) {
    storeEvent({
      type: 'game_start',
      gameId,
      mode, // '2p' or '1p'
      difficulty,
      userId: getUserId(),
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    });
  },

  // Track a game ending
  gameEnd(gameId, mode, winner, duration, difficulty = null) {
    storeEvent({
      type: 'game_end',
      gameId,
      mode,
      winner, // 1, 2, 'bot', or 'draw'
      duration, // in seconds
      difficulty,
      userId: getUserId(),
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    });
  },

  // Track a page/screen view
  screenView(screenName) {
    storeEvent({
      type: 'screen_view',
      screen: screenName,
      userId: getUserId(),
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    });
  },

  // Track tournament events
  tournamentEvent(action, data = {}) {
    storeEvent({
      type: 'tournament',
      action, // 'start', 'end', 'game_complete'
      ...data,
      userId: getUserId(),
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    });
  },

  // Get all stored events (for admin panel)
  getEvents() {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  },

  // Get aggregated stats
  getStats() {
    const events = this.getEvents();
    const gameStarts = events.filter(e => e.type === 'game_start');
    const gameEnds = events.filter(e => e.type === 'game_end');
    
    // Games played per game
    const gamesPerGame = {};
    gameStarts.forEach(e => {
      gamesPerGame[e.gameId] = (gamesPerGame[e.gameId] || 0) + 1;
    });

    // Average duration per game
    const durationPerGame = {};
    gameEnds.forEach(e => {
      if (!durationPerGame[e.gameId]) durationPerGame[e.gameId] = [];
      durationPerGame[e.gameId].push(e.duration || 0);
    });

    const avgDuration = {};
    Object.keys(durationPerGame).forEach(id => {
      const durations = durationPerGame[id];
      avgDuration[id] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    });

    // Mode breakdown
    const modeCount = { '2p': 0, '1p': 0 };
    gameStarts.forEach(e => {
      if (e.mode) modeCount[e.mode] = (modeCount[e.mode] || 0) + 1;
    });

    // Unique sessions
    const uniqueSessions = new Set(events.map(e => e.sessionId).filter(Boolean));
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean));

    // Daily activity (last 7 days)
    const dailyActivity = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyActivity[key] = 0;
    }
    gameStarts.forEach(e => {
      const key = e.timestamp?.split('T')[0];
      if (key && dailyActivity.hasOwnProperty(key)) {
        dailyActivity[key]++;
      }
    });

    return {
      totalGamesPlayed: gameStarts.length,
      totalSessions: uniqueSessions.size,
      totalUsers: uniqueUsers.size,
      gamesPerGame,
      avgDuration,
      modeCount,
      dailyActivity,
    };
  },

  // Clear all analytics data
  clearAll() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ANALYTICS_KEY);
  },
};
