import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Wifi, WifiOff, 
  MessageSquare, BarChart3, ScanLine
} from 'lucide-react';
import ChatWidget from './ChatWidget';

export default function Layout() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check backend health
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8001/health');
        setBackendOnline(res.ok);
      } catch { setBackendOnline(false); }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'डैशबोर्ड', labelEn: 'Dashboard' },
    { to: '/forms', icon: FileText, label: 'सेवा फॉर्म', labelEn: 'Service Forms' },
    { to: '/scanner', icon: ScanLine, label: 'OCR स्कैनर', labelEn: 'Document Scanner' },
    { to: '/analytics', icon: BarChart3, label: 'विश्लेषण', labelEn: 'Analytics' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col shadow-2xl">
        <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">सहायक</h1>
              <p className="text-xs text-slate-400">AI Co-Pilot for CSC</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-sm">{item.label}</div>
                <div className="text-xs opacity-60">{item.labelEn}</div>
              </div>
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-slate-700/30 rounded-xl p-3">
            <div className="text-xs text-slate-400">ऑपरेटर / Operator</div>
            <div className="text-sm font-medium text-white mt-1">CSC-OP-10492</div>
            <div className="text-xs text-slate-500 mt-0.5">Rajnandgaon, CG</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">
            नमस्ते, ऑपरेटर 👋
          </h2>
          
          <div className="flex items-center gap-3">
            {/* Backend Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              backendOnline 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {backendOnline ? 'AI सक्रिय' : 'AI ऑफलाइन'}
            </div>
            
            {/* Network Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isOnline 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'ऑनलाइन' : 'ऑफलाइन'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
        
        {/* Global Chat Widget */}
        <ChatWidget />
      </main>
    </div>
  );
}
