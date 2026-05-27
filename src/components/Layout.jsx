import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, LogOut, Shield, Search, CalendarCheck, BarChart3, FileText, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';

const Layout = ({ children }) => {
  const { profile, logout, loading } = useAuth();
  const { academicYear, setAcademicYear } = useData();
  const { siteBranding } = useTheme();
  const { school, isReadOnly, isSuspended, hasWarning } = useSubscription();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 6}, (_, i) => `${currentYear - 1 + i}`);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading || !profile) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255,255,255,0.1)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p style={{ color: '#94a3b8' }}>Loading secure session...</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to right, #0f172a, #1e293b)',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '1.5rem',
          padding: '3rem 2.5rem',
          maxWidth: '550px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
            Portal Access Suspended
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            The subscription for <strong style={{ color: '#f8fafc' }}>{school?.school_name}</strong> is currently inactive or suspended. Please contact Gyanoday Niketan Billing to reactivate your school portal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a 
              href="mailto:billing@gn.cloud" 
              style={{
                background: '#ef4444',
                color: 'white',
                textDecoration: 'none',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
            >
              Contact Billing (billing@gn.cloud)
            </a>
            <button 
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              Logout Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout" style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
      <aside className="sidebar" style={{ 
        boxShadow: '4px 0 24px rgba(0,0,0,0.02)', 
        background: 'var(--surface-color)',
        borderRight: '1px solid rgba(0,0,0,0.05)',
        zIndex: 40
      }}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', background: 'linear-gradient(to right, rgba(37, 99, 235, 0.05), transparent)' }}>
          <img src={siteBranding?.logoUrl || "/logo.png"} alt="School Logo" style={{ width: '72px', height: '72px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.025em', color: 'var(--primary-color)' }}>{siteBranding?.siteName || 'Gyanoday Niketan'}</span>
        </div>
        
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
           <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Account</p>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
               {(profile?.name || 'T')[0].toUpperCase()}
             </div>
             <div>
               <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{profile?.name || 'Teacher'}</strong>
               {profile?.role === 'admin' ? (
                 <span style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 600 }}>Administrator</span>
               ) : (
                 <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Faculty Member</span>
               )}
             </div>
           </div>
           
           <div style={{ marginTop: '1.5rem' }}>
             <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Year</label>
             <select 
               className="input-field" 
               style={{ padding: '0.5rem', marginTop: '0.5rem', fontSize: '0.875rem', background: 'var(--bg-color)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '0.5rem', fontWeight: 500 }}
               value={academicYear}
               onChange={(e) => setAcademicYear(e.target.value)}
             >
               {years.map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
           </div>
        </div>

        <nav className="sidebar-nav" style={{ padding: '1rem' }}>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 600, padding: '0 0.5rem 0.5rem' }}>Menu</p>
          
          {profile?.role === 'student' && (
            <NavLink to="/student-portal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
              <LayoutDashboard size={18} /> Student Portal
            </NavLink>
          )}

          {(profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'principal') && (
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
              <LayoutDashboard size={18} /> Dashboard
            </NavLink>
          )}

          {(profile?.role === 'student' || profile?.role === 'teacher' || profile?.role === 'admin') && (
            <>
              <NavLink to="/study-materials" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <BookOpen size={18} /> Study Materials
              </NavLink>
              <NavLink to="/assignments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <FileText size={18} /> Assignments
              </NavLink>
            </>
          )}

          {(profile?.role === 'teacher' || profile?.role === 'admin') && (
            <>
              <NavLink to="/classes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <Users size={18} /> My Classes
              </NavLink>
              <NavLink to="/attendance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <CalendarCheck size={18} /> Attendance
              </NavLink>
            </>
          )}

          {(profile?.role === 'principal' || profile?.role === 'admin') && (
            <>
              <NavLink to="/principal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <Shield size={18} /> Principal Portal
              </NavLink>
              <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <BarChart3 size={18} /> Analytics
              </NavLink>
              <NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <Search size={18} /> Search Users
              </NavLink>
            </>
          )}

          {profile?.role === 'admin' && (
             <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
               <Shield size={18} /> Admin Panel
             </NavLink>
          )}

          <div className="nav-item" style={{ marginTop: 'auto', cursor: 'pointer', borderRadius: '0.5rem', color: '#ef4444' }} onClick={handleLogout}>
            <LogOut size={18} /> Secure Logout
          </div>
        </nav>
      </aside>
      
      <main className="main-content" style={{ background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        {isReadOnly && (
          <div style={{
            background: 'linear-gradient(to right, #ef4444, #b91c1c)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            fontWeight: '600',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <AlertTriangle size={18} />
            <span>School subscription has expired. The portal is in <strong>Read-Only Mode</strong>. Data changes are locked.</span>
          </div>
        )}
        {!isReadOnly && hasWarning && (
          <div style={{
            background: 'linear-gradient(to right, #f59e0b, #d97706)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            fontWeight: '600',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <AlertTriangle size={18} />
            <span>Subscription Notice: School license expires soon. Please renew subscription to avoid portal locking.</span>
          </div>
        )}

        <div style={{ padding: '2rem 1.5rem', flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
