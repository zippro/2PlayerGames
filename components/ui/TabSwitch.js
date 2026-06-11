'use client';

export default function TabSwitch({ activeTab, onTabChange }) {
  return (
    <div className="tab-switch" role="tablist" style={{
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 4,
    }}>
      <button
        className={`tab-switch-btn ${activeTab === '2p' ? 'active' : ''}`}
        onClick={() => onTabChange('2p')}
        role="tab"
        aria-selected={activeTab === '2p'}
        id="tab-2p"
        style={activeTab === '2p' ? {
          background: 'linear-gradient(135deg, rgba(255,107,107,0.2), rgba(78,205,196,0.2))',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
        } : {}}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.8 }}>
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
        2 Players
      </button>
      <button
        className={`tab-switch-btn ${activeTab === '1p' ? 'active' : ''}`}
        onClick={() => onTabChange('1p')}
        role="tab"
        aria-selected={activeTab === '1p'}
        id="tab-1p"
        style={activeTab === '1p' ? {
          background: 'linear-gradient(135deg, rgba(255,184,48,0.2), rgba(155,89,182,0.2))',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
        } : {}}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.8 }}>
          <path d="M20 9V6h-2v3h-3v2h3v3h2v-3h3V9h-3zM9 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        vs Bot
      </button>
    </div>
  );
}
