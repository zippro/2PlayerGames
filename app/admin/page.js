'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GAMES } from '@/lib/gameRegistry';
import { analytics } from '@/lib/analytics';

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: -10,
        right: -10,
        fontSize: 48,
        opacity: 0.12,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        color: color || 'var(--text-primary)',
      }}>
        {value}
      </span>
    </div>
  );
}

function MiniBarChart({ data, color }) {
  const max = Math.max(...Object.values(data), 1);
  const entries = Object.entries(data);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {entries.map(([label, val]) => (
        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%',
            height: Math.max(4, (val / max) * 60),
            background: color || 'var(--accent-yellow)',
            borderRadius: 4,
            transition: 'height 0.5s ease',
          }} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {label.slice(5)} {/* Show only MM-DD */}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [gameSettings, setGameSettings] = useState(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem('2pg_game_settings');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    setStats(analytics.getStats());
  }, []);

  const updateGameSetting = useCallback((gameId, key, value) => {
    setGameSettings(prev => {
      const next = {
        ...prev,
        [gameId]: { ...prev[gameId], [key]: value }
      };
      localStorage.setItem('2pg_game_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleClearAnalytics = useCallback(() => {
    if (confirm('Clear all analytics data?')) {
      analytics.clearAll();
      setStats(analytics.getStats());
    }
  }, []);

  if (!stats) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'games', label: 'Games' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      {/* Admin Header */}
      <div style={{
        padding: '16px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-body)',
          }}
        >
          ‹ Back
        </button>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          letterSpacing: 1,
        }}>
          ADMIN PANEL
        </h1>
        <div style={{ width: 50 }} />
      </div>

      {/* Tab Nav */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 12px',
        overflowX: 'auto',
      }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeSection === item.id ? 'var(--bg-card)' : 'transparent',
              color: activeSection === item.id ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px 16px 100px' }}>
        {/* Dashboard Section */}
        {activeSection === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              <StatCard label="Total Games" value={stats.totalGamesPlayed} icon="G" color="var(--accent-yellow)" />
              <StatCard label="Sessions" value={stats.totalSessions} icon="S" color="var(--accent-green)" />
              <StatCard label="2P Games" value={stats.modeCount['2p'] || 0} icon="2" color="var(--p1-color)" />
              <StatCard label="1P Games" value={stats.modeCount['1p'] || 0} icon="1" color="var(--p2-color)" />
            </div>

            {/* Daily Activity Chart */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 20,
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                marginBottom: 16,
              }}>
                Daily Activity (Last 7 Days)
              </h3>
              <MiniBarChart data={stats.dailyActivity} color="var(--accent-yellow)" />
            </div>

            {/* Games Popularity */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 20,
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                marginBottom: 16,
              }}>
                Game Popularity
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {GAMES.map(game => {
                  const count = stats.gamesPerGame[game.id] || 0;
                  const maxCount = Math.max(...Object.values(stats.gamesPerGame), 1);
                  return (
                    <div key={game.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20, width: 30, textAlign: 'center' }}></span>
                      <span style={{ fontSize: 13, fontWeight: 600, width: 90, flexShrink: 0 }}>{game.name}</span>
                      <div style={{
                        flex: 1,
                        height: 20,
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.max(2, (count / maxCount) * 100)}%`,
                          background: game.gradient,
                          borderRadius: 10,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, width: 30, textAlign: 'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Average Duration */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 20,
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                marginBottom: 16,
              }}>
                Avg. Game Duration
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {GAMES.map(game => {
                  const dur = stats.avgDuration[game.id];
                  return (
                    <div key={game.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <span style={{ fontSize: 13 }}> {game.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-yellow)' }}>
                        {dur ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clear Analytics */}
            <button
              onClick={handleClearAnalytics}
              style={{
                padding: 12,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                color: '#EF4444',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Clear All Analytics Data
            </button>
          </div>
        )}

        {/* Games Management Section */}
        {activeSection === 'games' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              marginBottom: 4,
            }}>
              Game Management
            </h3>
            {GAMES.map(game => {
              const settings = gameSettings[game.id] || {};
              const isEnabled = settings.enabled !== false;

              return (
                <div key={game.id} style={{
                  background: 'var(--bg-card)',
                  borderRadius: 16,
                  padding: 16,
                  opacity: isEnabled ? 1 : 0.5,
                  transition: 'opacity 0.3s',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 28 }}></span>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{game.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Modes: {game.modes.join(', ').toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`toggle-switch ${isEnabled ? 'active' : ''}`}
                      onClick={() => updateGameSetting(game.id, 'enabled', !isEnabled)}
                      aria-label={`Toggle ${game.name}`}
                    />
                  </div>

                  {isEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 42 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Featured</span>
                        <button
                          className={`toggle-switch ${settings.featured ? 'active' : ''}`}
                          onClick={() => updateGameSetting(game.id, 'featured', !settings.featured)}
                          style={{ transform: 'scale(0.8)' }}
                        />
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Show "NEW" Badge</span>
                        <button
                          className={`toggle-switch ${settings.showBadge ? 'active' : ''}`}
                          onClick={() => updateGameSetting(game.id, 'showBadge', !settings.showBadge)}
                          style={{ transform: 'scale(0.8)' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* App Settings Section */}
        {activeSection === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              marginBottom: 4,
            }}>
              App Settings
            </h3>
            
            <div className="settings-group">
              <div className="settings-item">
                <span className="settings-item-label">Sound Effects</span>
                <button
                  className={`toggle-switch ${gameSettings.soundEnabled ? 'active' : ''}`}
                  onClick={() => updateGameSetting('_global', 'soundEnabled', !gameSettings._global?.soundEnabled)}
                />
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Vibration</span>
                <button
                  className={`toggle-switch ${gameSettings._global?.vibrationEnabled ? 'active' : ''}`}
                  onClick={() => updateGameSetting('_global', 'vibrationEnabled', !gameSettings._global?.vibrationEnabled)}
                />
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Show Tutorials</span>
                <button
                  className={`toggle-switch ${gameSettings._global?.showTutorials !== false ? 'active' : ''}`}
                  onClick={() => updateGameSetting('_global', 'showTutorials', gameSettings._global?.showTutorials === false)}
                />
              </div>
              <div className="settings-item">
                <span className="settings-item-label">Tournament Target Score</span>
                <select
                  value={gameSettings._global?.tournamentTarget || 5}
                  onChange={(e) => updateGameSetting('_global', 'tournamentTarget', parseInt(e.target.value))}
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                  <option value={7}>Best of 7</option>
                  <option value={10}>Best of 10</option>
                </select>
              </div>
            </div>

            {/* App Info */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>
                2 Player Games
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Version 1.0.0
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                © 2026 Narcade
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
