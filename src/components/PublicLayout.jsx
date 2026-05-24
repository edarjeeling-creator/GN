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
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Academics', path: '/academics' },
    { name: 'Admissions', path: '/admissions' },
    { name: 'Faculty', path: '/faculty' },
    { name: 'Contact', path: '/contact' }
  ];

  return (
    <div className={`app-layout-public ${isDarkMode ? 'dark' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <nav className="public-nav">
        <div className="public-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '5rem' }}>
            {/* Logo Area */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src="/logo.png" alt="SmartGrades Logo" style={{ height: '3rem', width: '3rem', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '-0.025em', color: 'var(--primary-color)' }}>SmartGrades</span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>School Campus</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div style={{ display: 'none', alignItems: 'center', gap: '2rem' }} className="md-flex">
              {navLinks.map((link) => (
                <NavLink 
                  key={link.name} 
                  to={link.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {link.name}
                </NavLink>
              ))}
            </div>

            {/* Right Actions */}
            <div style={{ display: 'none', alignItems: 'center', gap: '1rem' }} className="md-flex">
              <button onClick={toggleDarkMode} style={{ padding: '0.5rem', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <Link to="/login" className="nav-btn hover-scale">
                Login Portal
              </Link>
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
      <footer className="public-footer">
        <div className="public-container">
          <div className="footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <img src="/logo.png" alt="SmartGrades Logo" style={{ height: '2.5rem', width: '2.5rem', filter: 'brightness(0) invert(1)' }} />
                <span style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '-0.025em' }}>SmartGrades</span>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: '1.625', marginBottom: '1.5rem' }}>
                Empowering the next generation with a futuristic digital campus. Interactive, intelligent, secure, and visually unforgettable.
              </p>
            </div>
            
            <div>
              <h3 style={{ fontWeight: '600', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Quick Links</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                <li><Link to="/about" className="footer-link">About Us</Link></li>
                <li><Link to="/admissions" className="footer-link">Admissions</Link></li>
                <li><Link to="/academics" className="footer-link">Academics</Link></li>
                <li><Link to="/contact" className="footer-link">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontWeight: '600', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Portals</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                <li><Link to="/login" className="footer-link">Student Login</Link></li>
                <li><Link to="/login" className="footer-link">Parent Portal</Link></li>
                <li><Link to="/login" className="footer-link">Teacher Dashboard</Link></li>
                <li><Link to="/result" className="footer-link">Result Portal</Link></li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontWeight: '600', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Contact Us</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                <li>📍 123 Education Lane, Digital City</li>
                <li>📞 +1 (555) 123-4567</li>
                <li>✉️ contact@smartgrades.edu</li>
              </ul>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid #1f2937', marginTop: '3rem', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
            <p>&copy; {new Date().getFullYear()} SmartGrades School. All rights reserved.</p>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link to="#" className="footer-link">Privacy Policy</Link>
              <Link to="#" className="footer-link">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
