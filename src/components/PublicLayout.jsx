import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, ChevronDown, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PublicLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navLinks = [
    { name: 'ABOUT US', path: '/about' },
    { name: 'FACULTY', path: '/faculty' },
    { name: 'ACADEMICS', path: '/academics', sub: 'Kindergarten Primary Middle' },
    { name: 'ADMISSIONS', path: '/admissions' },
    { name: 'GALLERY', path: '/gallery' },
    { name: 'NOTICES/CIRCULARS', path: '/notices' },
    { name: 'CONTACT US', path: '/contact' }
  ];

  return (
    <div className={`app-layout-public ${isDarkMode ? 'dark' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100vw', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <nav className="public-nav" style={{ padding: '0.5rem 0' }}>
        <div className="public-container">
          {/* Top Top Bar: Buttons and Search */}
          <div className="top-bar-container" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Link to="/login" className="btn-hero-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderColor: '#f59e0b', color: '#f59e0b' }}>PARENT PORTAL</Link>
            <Link to="/login" className="btn-hero-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: '#166534', color: 'white', boxShadow: 'none' }}>STUDENT LOGIN</Link>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '0.25rem', padding: '0 0.5rem', flex: '1 1 auto', minWidth: '80px', maxWidth: '200px' }}>
              <input type="text" placeholder="Search..." style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.75rem', padding: '0.2rem', color: '#1f2937' }} />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>🔍</span>
            </div>
            <button onClick={toggleDarkMode} style={{ padding: '0.2rem', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}>
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Logo Area */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src="/logo.png" alt="Logo" style={{ height: '3.5rem', width: '3.5rem', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '800', fontSize: '1.2rem', letterSpacing: '0.05em', color: '#166534' }}>SMARTGRADES</span>
                <span style={{ fontSize: '0.7rem', color: '#6b7280', letterSpacing: '0.05em', fontWeight: '600' }}>ICSE SCHOOL</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div style={{ display: 'none', alignItems: 'center', gap: '1.5rem' }} className="md-flex">
              {navLinks.map((link) => (
                <div key={link.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <NavLink 
                    to={link.path}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    style={{ fontWeight: '700', fontSize: '0.85rem' }}
                  >
                    {link.name}
                  </NavLink>
                  {link.sub && <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{link.sub}</span>}
                </div>
              ))}
            </div>

            {/* Mobile menu button */}
            <div style={{ display: 'flex', alignItems: 'center' }} className="md-hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', background: 'var(--card-bg)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}
              className="md-hidden"
            >
              <div style={{ padding: '0.5rem 1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {navLinks.map((link) => (
                  <NavLink
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{ display: 'block', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontWeight: '500', color: 'var(--text-public)' }}
                  >
                    {link.name}
                  </NavLink>
                ))}
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', color: 'var(--text-public)', cursor: 'pointer' }}>
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />} Toggle Theme
                  </button>
                  <Link to="/login" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '0.75rem', borderRadius: '0.375rem', fontWeight: '600', color: 'white', background: 'var(--primary-color)' }}>
                    Login Portal
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content Area */}
      <main style={{ flexGrow: 1, paddingTop: '5rem', background: 'var(--bg-public)', color: 'var(--text-public)' }}>
        {children}
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        <div className="public-container">
          <div className="footer-grid">
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: '#fcd34d' }}>Contact</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem', color: '#e5e7eb' }}>
                <li style={{ display: 'flex', gap: '0.5rem' }}>📍 <span>Address: Lebong Cart Rd, Darjeeling, <br/>West Bengal 734101</span></li>
                <li style={{ display: 'flex', gap: '0.5rem' }}>📞 <span>Phone: +91 5555 123456</span></li>
                <li style={{ display: 'flex', gap: '0.5rem' }}>✉️ <span>Email: smartgrades.edu@gmail.com</span></li>
              </ul>
            </div>
            
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: '#fcd34d' }}>Quick Links</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                <li><Link to="/admissions" className="footer-link">Admissions 2026-27</Link></li>
                <li><Link to="/academics" className="footer-link">Academic Calendar</Link></li>
                <li><Link to="/notices" className="footer-link">Latest Notices</Link></li>
                <li><Link to="/contact" className="footer-link">Careers</Link></li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: '#fcd34d' }}>Social Media</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>f</div>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>in</div>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>Y</div>
              </div>
            </div>

            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: '#fcd34d' }}>Find Us</h3>
              <div style={{ background: '#e2e8f0', width: '100%', height: '120px', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem' }}>
                [Google Map Embed]
              </div>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid #14532d', marginTop: '3rem', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#86efac' }}>
            <p>Affiliated to CISCE, New Delhi (WB046)</p>
            <p>&copy; {new Date().getFullYear()} SmartGrades School. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
