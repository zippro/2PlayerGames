'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { sounds } from '@/lib/sounds';

const SettingIcon = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
    <path d={d}/>
  </svg>
);

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({});
  
  useEffect(() => {
    setSettings(JSON.parse(localStorage.getItem('2pg_settings') || '{}'));
  }, []);

  const updateSetting = (key, val) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    localStorage.setItem('2pg_settings', JSON.stringify(next));
    sounds.tap();
  };

  const settingsItems = [
    {
      key: 'sound',
      label: 'Sound Effects',
      icon: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    },
    {
      key: 'vibration',
      label: 'Vibration',
      icon: 'M0 15h2V9H0v6zm3 2h2V7H3v10zm4-12v14h2V5H7zm4-2v18h2V3h-2zm4 2v14h2V5h-2zm3 2v10h2V7h-2zm3 2v6h2V9h-2z',
    },
    {
      key: 'tutorials',
      label: 'Show Tutorials',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
    },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        gap: 12,
      }}>
        <button
          onClick={() => { sounds.tap(); router.push('/'); }}
          className="header-btn"
          aria-label="Back"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}>
          Settings
        </h1>
      </div>

      <div style={{ padding: '0 16px 100px' }}>
        <div className="settings-group" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
        }}>
          {settingsItems.map((item) => (
            <div className="settings-item" key={item.key}>
              <span className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SettingIcon d={item.icon} />
                {item.label}
              </span>
              <button
                className={`toggle-switch ${settings[item.key] !== false ? 'active' : ''}`}
                onClick={() => updateSetting(item.key, settings[item.key] === false)}
              />
            </div>
          ))}
        </div>

        {/* Admin access */}
        <button
          onClick={() => { sounds.tap(); router.push('/admin'); }}
          style={{
            width: '100%',
            padding: 16,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 16,
            letterSpacing: 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
          Admin Panel
        </button>

        {/* About */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: 24,
          textAlign: 'center',
          marginTop: 16,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, marginBottom: 8 }}>
            <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>2 Player Games</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>The Challenge</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, opacity: 0.5 }}>v1.0.0 — Narcade</div>
        </div>
      </div>
    </div>
  );
}
