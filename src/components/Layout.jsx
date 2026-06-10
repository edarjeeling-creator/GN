import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, LogOut, Shield, Search, CalendarCheck, BarChart3, FileText, AlertTriangle, Lock, Menu, X, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';
import { supabase } from '../lib/supabase';

const Layout = ({ children }) => {
  const { profile, logout, loading } = useAuth();
  const { academicYear, setAcademicYear, students } = useData();
  const { siteBranding } = useTheme();
  const { school, isReadOnly, isSuspended, hasWarning } = useSubscription();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (profile?.role === 'student') {
      fetchUnreadCount();
      
      const channel = supabase.channel('student_notifications_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'student_notifications' }, () => {
           fetchUnreadCount();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile, students]);

  const fetchUnreadCount = async () => {
    if (!profile || !students) return;
    const student = students?.find(s => s.uid === profile.id);
    if (!student) return;
    
    const { count } = await supabase
      .from('student_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('is_read', false);
      
    setUnreadNotifications(count || 0);
  };

  // Close sidebar on path changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [window.location.pathname]);

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
    <div className="app-layout" style={{ background: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      {isMobile && (
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          background: 'var(--surface-color)',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          width: '100%',
          height: '60px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={siteBranding?.logoUrl || "/logo.png"} alt="School Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--primary-color)', letterSpacing: '-0.02em' }}>
              {siteBranding?.siteName || 'Gyanoday Niketan'}
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'rgba(37, 99, 235, 0.08)',
              border: 'none',
              borderRadius: '0.375rem',
              color: 'var(--primary-color)',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
      )}

      {isMobile && isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.3)',
            zIndex: 39,
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ 
        boxShadow: '4px 0 24px rgba(0,0,0,0.02)', 
        background: 'var(--surface-color)',
        borderRight: '1px solid rgba(0,0,0,0.05)',
        zIndex: 40
      }}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '1.5rem', background: 'linear-gradient(to right, rgba(37, 99, 235, 0.05), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={siteBranding?.logoUrl || "/logo.png"} alt="School Logo" style={{ width: '72px', height: '72px', objectFit: 'contain' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.025em', color: 'var(--primary-color)' }}>{siteBranding?.siteName || 'Gyanoday Niketan'}</span>
          </div>
          {isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
           <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Account</p>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', position: 'relative' }}>
             {profile?.picture_url ? (
               <img src={profile.picture_url} alt={profile.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid transparent', transition: 'border-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='transparent'} />
             ) : (
               <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid transparent', transition: 'border-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='transparent'}>
                 {(profile?.name || 'T')[0].toUpperCase()}
               </div>
             )}
             <input 
               type="file" 
               accept="image/*" 
               title="Upload Profile Picture"
               onChange={async (e) => {
                 const file = e.target.files?.[0];
                 if (!file) return;
                 if (file.size > 2 * 1024 * 1024) return alert("File too large. Please select an image under 2MB.");
                 const reader = new FileReader();
                 reader.onload = async (evt) => {
                   const { error } = await supabase.from('profiles').update({ picture_url: evt.target.result }).eq('id', profile.id);
                   if (error) alert("Failed to upload photo.");
                   else window.location.reload();
                 };
                 reader.readAsDataURL(file);
               }}
               style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', width: '36px', height: '36px' }}
             />
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
            <NavLink to="/student-portal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LayoutDashboard size={18} /> Student Portal
              </div>
              {unreadNotifications > 0 && (
                <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>
                  {unreadNotifications}
                </span>
              )}
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
              <NavLink to="/weekly-tests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: '0.5rem', marginBottom: '0.25rem' }}>
                <FileText size={18} /> Weekly Tests
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
