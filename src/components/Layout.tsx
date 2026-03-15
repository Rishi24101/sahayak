import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Wifi, WifiOff,
  BarChart3, ScanLine, ChevronRight, User, LogOut
} from 'lucide-react';
import ChatWidget from './ChatWidget';

export default function Layout({ onLogout }: { onLogout?: () => void }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendOnline, setBackendOnline] = useState(false);
  const currentTime = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkBackend = async () => {
      try { const r = await fetch('http://localhost:8001/health'); setBackendOnline(r.ok); }
      catch { setBackendOnline(false); }
    };
    checkBackend();
    const t = setInterval(checkBackend, 10000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(t);
    };
  }, []);

  const navItems = [
    { to: '/',         icon: LayoutDashboard, label: 'डैशबोर्ड',    sub: 'Dashboard' },
    { to: '/forms',    icon: FileText,         label: 'सेवा फॉर्म',   sub: 'Service Forms' },
    { to: '/scanner',  icon: ScanLine,         label: 'OCR स्कैनर',  sub: 'Document Scanner' },
    { to: '/analytics',icon: BarChart3,        label: 'विश्लेषण',    sub: 'Analytics' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--csc-bg)' }}>

      {/* ── Sidebar ── */}
      <aside className="csc-sidebar" style={{ width: 256, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Logo Area */}
        <div className="csc-sidebar-logo" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Ashoka Wheel placeholder */}
          <div style={{
            width: 44, height: 44, borderRadius: 4,
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 22 }}>🇮🇳</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>सहायक</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>CSC AI सह-पायलट</div>
            <div style={{ color: 'var(--csc-orange)', fontSize: 10, fontWeight: 600, marginTop: 2, letterSpacing: '0.04em' }}>COMMON SERVICE CENTRE</div>
          </div>
        </div>

        {/* Tricolor stripe */}
        <div className="csc-tricolor" />

        {/* Nav section label */}
        <div style={{ padding: '12px 14px 4px', color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          मुख्य मेनू / NAVIGATION
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `csc-nav-link${isActive ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', textDecoration: 'none', marginBottom: 1 }}
            >
              <item.icon size={17} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>{item.sub}</div>
              </div>
              <ChevronRight size={13} style={{ opacity: 0.4 }} />
            </NavLink>
          ))}
        </nav>

        {/* Operator Card */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--csc-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={15} color="white" />
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>VLE ऑपरेटर</div>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, marginTop: 1 }}>CSC-OP-10492</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Rajnandgaon, CG</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Government Header */}
        <div className="csc-tricolor" />
        <header className="csc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>नमस्ते, VLE ऑपरेटर 🙏</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                सामान्य सेवा केंद्र | Rajnandgaon, Chhattisgarh
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Time */}
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginRight: 4 }}>{currentTime}</div>

            {/* Backend Status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: backendOnline ? 'rgba(19,136,8,0.25)' : 'rgba(192,57,43,0.25)',
              border: `1px solid ${backendOnline ? 'rgba(19,136,8,0.5)' : 'rgba(192,57,43,0.5)'}`,
              borderRadius: 3, padding: '4px 10px', fontSize: 11, color: 'white'
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: backendOnline ? '#4caf50' : '#e74c3c',
                ...(backendOnline ? { animation: 'pulse 2s infinite' } : {})
              }} />
              {backendOnline ? '● AI सक्रिय' : '○ ऑफलाइन'}
            </div>

            {/* Network Status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: isOnline ? 'rgba(255,255,255,0.1)' : 'rgba(192,57,43,0.25)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 3, padding: '4px 10px', fontSize: 11, color: 'white'
            }}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isOnline ? 'ऑनलाइन' : 'ऑफलाइन'}
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button 
                onClick={onLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 3, padding: '4px 10px', fontSize: 11, color: 'white',
                  cursor: 'pointer', transition: 'all 0.2s', marginLeft: 4
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                title="लॉगआउट"
              >
                <LogOut size={12} />
                साइन आउट
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <Outlet />
        </div>

        {/* Global Chat Widget */}
        <ChatWidget />
      </main>
    </div>
  );
}
