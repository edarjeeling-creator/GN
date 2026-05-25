import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, LogOut, Shield, Search, CalendarCheck, BarChart3, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeProvider';

const Layout = ({ children }) => {
  const { profile, logout } = useAuth();
  const { academicYear, setAcademicYear } = useData();
  const { siteBranding } = useTheme();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 6}, (_, i) => `${currentYear - 1 + i}`);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
      
      <main className="main-content" style={{ background: '#f8fafc' }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
