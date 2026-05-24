import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, LogOut, Shield, Search, CalendarCheck, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const Layout = ({ children }) => {
  const { profile, logout } = useAuth();
  const { academicYear, setAcademicYear } = useData();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 6}, (_, i) => `${currentYear - 1 + i}`);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="School Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span>SmartGrades</span>
        </div>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
           Logged in as:<br/>
           <strong style={{ color: 'var(--text-primary)' }}>{profile?.name || 'Teacher'}</strong>
           {profile?.role === 'admin' && <span className="badge badge-primary" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Admin</span>}
           
           <div className="mt-4">
             <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Academic Year:</label>
             <select 
               className="input-field" 
               style={{ padding: '0.25rem', marginTop: '0.25rem', fontSize: '0.875rem' }}
               value={academicYear}
               onChange={(e) => setAcademicYear(e.target.value)}
             >
               {years.map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
           </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/classes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} /> My Classes
          </NavLink>
          <NavLink to="/attendance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CalendarCheck size={20} /> Attendance
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 size={20} /> Analytics
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Search size={20} /> Search Students
          </NavLink>
          
          {profile?.role === 'admin' && (
             <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
               <Shield size={20} /> Admin Panel
             </NavLink>
          )}

          <div className="nav-item" style={{ marginTop: 'auto', cursor: 'pointer' }} onClick={handleLogout}>
            <LogOut size={20} /> Logout
          </div>
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
