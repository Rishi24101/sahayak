import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, KeyRound, User, UserPlus, AlertCircle, Building2, Mail } from 'lucide-react';

export default function Signup({ onLogin }: { onLogin: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cscId, setCscId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !cscId || !password) {
      setError('कृपया सभी फ़ील्ड भरें / Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    // Simulate signup & login delay
    setTimeout(() => {
      onLogin(); // Auto login after signup
      navigate('/');
    }, 1200);
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

      {/* Main Signup Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #1a3f6f 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Signup Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-[#1a3f6f] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-100 shadow-sm">
                <Building2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#1a3f6f]">VLE ऑपरेटर पंजीकरण</h2>
              <p className="text-sm text-slate-500 mt-1">नया CSC खाता बनाएं / Create New CSC Account</p>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleSignup} className="p-6 md:p-8 space-y-5">
              
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    पूरा नाम / Full Name
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="आपका नाम दर्ज करें"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3f6f] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    ईमेल आईडी / Email ID
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@csc.gov.in"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3f6f] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* CSC ID */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    CSC ID
                  </label>
                  <div className="relative">
                    <Shield className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1a3f6f] hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    पंजीकरण करें / Sign Up
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-sm text-slate-500">पहले से खाता है? </span>
                <Link to="/login" className="text-sm text-[#e07b1e] hover:underline font-bold">
                  साइन इन करें / Sign In
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
