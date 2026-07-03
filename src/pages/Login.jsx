import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeProvider';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LogIn, ArrowLeft, Loader2 } from 'lucide-react';

const Login = () => {
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoginSuccess, setAutoLoginSuccess] = useState(false);
  const hasAttempted = useRef(false);
  
  const { session, profile, unifiedLogin } = useAuth();
  const { siteBranding } = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('auto');
    const urlName = params.get('name');
    const urlUid = params.get('uid');

    if (auto === 'true' && urlName && urlUid && !hasAttempted.current) {
      hasAttempted.current = true;
      setName(urlName);
      setUid(urlUid);
      
      const performAutoLogin = async () => {
        setLoading(true);
        setError('');
        
        const { error } = await unifiedLogin(urlName, urlUid);
        if (error) {
          setError(error.message || 'Auto-login failed.');
          setLoading(false);
        } else {
          setAutoLoginSuccess(true);
        }
      };
      
      performAutoLogin();
    }
  }, [unifiedLogin]);

  if (session || profile?.role === 'student') {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('auto');

    if (auto !== 'true' || autoLoginSuccess) {
      if (profile?.role === 'student') return <Navigate to="/student-portal" replace />;
      if (profile?.role === 'principal') return <Navigate to="/principal" replace />;
      if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error } = await unifiedLogin(name, uid);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-900">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900 via-slate-900 to-slate-950"></div>
        <motion.div 
          animate={{ x: [-20, 20, -20], y: [-20, 20, -20], opacity: [0.3, 0.5, 0.3] }}
          transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl mix-blend-screen"
        />
        <motion.div 
          animate={{ x: [20, -20, 20], y: [20, -20, 20], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 12, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full blur-3xl mix-blend-screen"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center z-10 px-4 sm:px-6 lg:px-8 relative">
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6, ease: "easeOut" }} 
          className="w-full max-w-md"
        >
          <Card className="border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-8 sm:p-10 !rounded-[2rem]">
            <Link to="/" className="flex justify-center mb-8 hover:scale-105 transition-transform duration-300">
              <img 
                src={siteBranding.logoUrl} 
                alt="Logo" 
                className="h-48 sm:h-56 w-auto object-contain drop-shadow-2xl" 
              />
            </Link>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                Welcome to {siteBranding.siteName}
              </h2>
              <p className="text-slate-300 text-sm font-medium">
                {siteBranding.siteMotto || "Sign in to access your portal"}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm text-center font-medium backdrop-blur-sm">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200 ml-1">
                  Email Address or Full Name
                </label>
                <Input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. email@example.com"
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-brand-500 focus-visible:border-brand-500 h-12"
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200 ml-1">
                  UID or Password
                </label>
                <Input 
                  type="password" 
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter your UID or Password"
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-brand-500 focus-visible:border-brand-500 h-12"
                  required 
                />
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] rounded-xl"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Authenticating...</>
                  ) : (
                    <><LogIn className="w-5 h-5 mr-2" /> Sign In securely</>
                  )}
                </Button>
              </div>
            </form>
            
            <div className="mt-8 text-center">
              <Link to="/" className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campus Home
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
