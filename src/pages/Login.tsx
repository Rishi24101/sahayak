import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, KeyRound, User, LogIn, AlertCircle } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [cscId, setCscId] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cscId || !password || !captcha) {
      setError('कृपया सभी फ़ील्ड भरें / Please fill all fields');
      return;
    }
    if (captcha !== '7b8z2') {
      setError('अमान्य कैप्चा / Invalid Captcha');
      return;
    }

    setLoading(true);
    setError('');
    
    // Simulate login delay
    setTimeout(() => {
      onLogin();
      navigate('/');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Government Header */}
      <header className="bg-[#1a3f6f] text-white border-b border-[#e07b1e]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-[#e07b1e]" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide">
                COMMON SERVICE CENTRE
              </h1>
              <p className="text-xs text-blue-200">
                सामान्य सेवा केंद्र | Digital India
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#" className="hover:text-[#e07b1e] transition-colors">Digital Seva Portal</a>
            <a href="#" className="hover:text-[#e07b1e] transition-colors">CSC Locator</a>
            <a href="#" className="hover:text-[#e07b1e] transition-colors">Helpdesk</a>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#e07b1e] via-white to-[#138808]" />
      </header>

      {/* Main Login Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #1a3f6f 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Login Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-[#1a3f6f] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-100 shadow-sm">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#1a3f6f]">VLE ऑपरेटर लॉगिन</h2>
              <p className="text-sm text-slate-500 mt-1">Digital Seva Connect</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="p-6 md:p-8 space-y-6">
              
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* CSC ID */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    CSC ID / उपयोगकर्ता नाम
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cscId}
                      onChange={(e) => setCscId(e.target.value)}
                      placeholder="Ex: 5792XXXXXX"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3f6f] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    पासवर्ड / Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3f6f] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Captcha */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    कैप्चा कोड दर्ज करें
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={captcha}
                        onChange={(e) => setCaptcha(e.target.value)}
                        placeholder="कैप्चा (7b8z2)"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3f6f] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="w-28 shrink-0 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center select-none font-mono text-lg font-bold text-slate-700 tracking-wider blur-[0.5px]">
                      7b8z2
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1a3f6f] hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    साइन इन / Sign In
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-sm text-slate-500">नया CSC खाता चाहिए? </span>
                <Link to="/signup" className="text-sm text-[#e07b1e] hover:underline font-bold">
                  पंजीकरण करें / Sign Up
                </Link>
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6 font-medium">
            कॉपीराइट © 2026 Common Service Centre | Ministry of Electronics & IT
          </p>
        </div>
      </main>
    </div>
  );
}
