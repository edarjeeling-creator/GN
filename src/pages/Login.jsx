import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeProvider';

const Login = () => {
  const [loginType, setLoginType] = useState('student'); // 'student' or 'faculty'
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { session, customLogin } = useAuth();
  const { siteBranding } = useTheme();

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Map login type to internal role ('student' or 'teacher')
    const role = loginType === 'faculty' ? 'teacher' : 'student';
    
    const { error } = await customLogin(role, name, uid);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="hero-section" style={{ minHeight: '100vh', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom right, #0f172a, #1e3a8a)' }}>
      {/* Background Particles */}
      <div className="hero-particles">
         <motion.div 
            animate={{ y: [0, -20, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="hero-orb-1"
         />
         <motion.div 
            animate={{ y: [0, 30, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
            className="hero-orb-2"
         />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '450px' }}>
        <div className="bento-card" style={{ padding: '3rem 2.5rem', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
          <Link to="/" style={{ display: 'block', textDecoration: 'none' }}>
            <img src={siteBranding.logoUrl} alt="School Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', margin: '0 auto 1.5rem', display: 'block' }} />
          </Link>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--heading-color, var(--primary-color))', fontSize: '1.8rem', fontWeight: 'bold', marginBottom: siteBranding.siteMotto ? '0.25rem' : '0' }}>{siteBranding.siteName}</h2>
            {siteBranding.siteMotto && <p style={{ color: 'var(--body-text-color, #64748b)', fontSize: '0.9rem', fontWeight: '500' }}>{siteBranding.siteMotto}</p>}
          </div>

          <div style={{ display: 'flex', marginBottom: '2rem', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.25rem' }}>
            <button 
              onClick={() => setLoginType('student')}
              style={{ flex: 1, padding: '0.75rem', border: 'none', background: loginType === 'student' ? 'white' : 'transparent', borderRadius: '0.375rem', fontWeight: loginType === 'student' ? 'bold' : 'normal', color: loginType === 'student' ? '#0f172a' : '#64748b', boxShadow: loginType === 'student' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Student Portal
            </button>
            <button 
              onClick={() => setLoginType('faculty')}
              style={{ flex: 1, padding: '0.75rem', border: 'none', background: loginType === 'faculty' ? 'white' : 'transparent', borderRadius: '0.375rem', fontWeight: loginType === 'faculty' ? 'bold' : 'normal', color: loginType === 'faculty' ? '#0f172a' : '#64748b', boxShadow: loginType === 'faculty' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Faculty Portal
            </button>
          </div>
          
          {error && <div className="badge badge-danger" style={{ width: '100%', textAlign: 'center', marginBottom: '1.5rem', padding: '0.75rem', borderRadius: '0.5rem' }}>{error}</div>}
          
          <AnimatePresence mode="wait">
            <motion.form 
              key={loginType}
              initial={{ opacity: 0, x: loginType === 'student' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: loginType === 'student' ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleLogin} 
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                  {loginType === 'student' ? 'Student Name' : 'Faculty Name'}
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.875rem' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={loginType === 'student' ? "e.g. John Doe" : "e.g. Rahul Sharma"}
                  required 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                  {loginType === 'student' ? 'Student UID (Password)' : 'Faculty UID (Password)'}
                </label>
                <input 
                  type="password" 
                  className="input-field" 
                  style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.875rem' }}
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter your secure UID"
                  required 
                />
              </div>
              <button type="submit" className="btn-hero-primary" style={{ marginTop: '1rem', background: 'var(--primary-color)', color: 'white', border: 'none', width: '100%' }} disabled={loading}>
                {loading ? 'Authenticating...' : `Sign in to ${loginType === 'student' ? 'Student' : 'Faculty'} Portal`}
              </button>
            </motion.form>
          </AnimatePresence>
          
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link to="/" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>&larr; Back to Campus Home</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
