import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeProvider';
import { Menu, X, ChevronDown, Moon, Sun, Phone, Mail, Clock, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PublicLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const { siteBranding, footerSettings, themeColors, mainMenu } = useTheme();

  return (
    <div className={`app-layout-public ${isDarkMode ? 'dark' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100vw', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <nav className="public-nav" style={{ padding: '0.5rem 0', backgroundColor: themeColors?.nav || '#166534', color: 'white' }}>
        <div className="public-container">
          {/* Top Top Bar: Buttons and Search */}
          <div className="top-bar-container" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Link to="/login" className="btn-hero-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: '#166534', color: 'white', boxShadow: 'none' }}>LOGIN</Link>
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
              <img src={siteBranding.logoUrl} alt="Logo" style={{ height: '3.5rem', width: '3.5rem', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '800', fontSize: '1.2rem', letterSpacing: '0.05em', color: 'white' }}>{siteBranding.siteName}</span>
                {siteBranding.siteMotto && <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.025em' }}>{siteBranding.siteMotto}</span>}
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div style={{ display: 'none', alignItems: 'center', gap: '1.5rem' }} className="md-flex">
              {mainMenu?.filter(item => item.isActive).map((link) => (
                <div key={link.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                  onMouseEnter={() => {
                    const dropdown = document.getElementById(`dropdown-${link.id}`);
                    if (dropdown) dropdown.style.display = 'block';
                  }}
                  onMouseLeave={() => {
                    const dropdown = document.getElementById(`dropdown-${link.id}`);
                    if (dropdown) dropdown.style.display = 'none';
                  }}
                >
                  <NavLink 
                    to={link.url}
                    className={({ isActive }) => `nav-link ${isActive && link.url !== '#' ? 'active' : ''}`}
                    style={{ fontWeight: '700', fontSize: '0.85rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                  >
                    {link.label} {link.type !== 'simple' && <ChevronDown size={14} />}
                  </NavLink>
                  
                  {/* Dropdown Menu */}
                  {link.children?.length > 0 && link.type === 'dropdown' && (
                    <div id={`dropdown-${link.id}`} style={{ display: 'none', position: 'absolute', top: '100%', left: 0, paddingTop: '1rem', zIndex: 50, minWidth: '200px' }}>
                      <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '0.5rem 0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}>
                        {link.children.map(child => (
                          <Link key={child.id} to={child.url} style={{ display: 'block', padding: '0.75rem 1.5rem', color: '#1f2937', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }} onMouseEnter={(e) => e.target.style.background = '#f1f5f9'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mega Menu */}
                  {link.children?.length > 0 && link.type === 'mega' && (
                    <div id={`dropdown-${link.id}`} style={{ display: 'none', position: 'fixed', top: '100px', left: '10%', width: '80%', paddingTop: '1rem', zIndex: 50 }}>
                      <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                        {link.children.map(child => (
                          <div key={child.id}>
                            <h4 style={{ color: '#0f172a', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', margin: 0 }}>{child.label}</h4>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {child.children?.map(sub => (
                                <li key={sub.id}>
                                  <Link to={sub.url} style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none', display: 'block', padding: '0.25rem 0' }} onMouseEnter={(e) => e.target.style.color = '#2563eb'} onMouseLeave={(e) => e.target.style.color = '#475569'}>{sub.label}</Link>
                                </li>
                              ))}
                              {!child.children?.length && (
                                <li>
                                  <Link to={child.url} style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>Go to {child.label} &rarr;</Link>
                                </li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                {mainMenu?.filter(item => item.isActive).map((link) => (
                  <div key={link.id}>
                    <NavLink
                      to={link.url}
                      onClick={() => !link.children?.length && setIsMobileMenuOpen(false)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontWeight: '500', color: 'var(--text-public)', textDecoration: 'none' }}
                    >
                      {link.label} {link.type !== 'simple' && <ChevronDown size={16} />}
                    </NavLink>
                    {link.children?.length > 0 && (
                      <div style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {link.children.map(child => (
                           <Link key={child.id} to={child.url} onClick={() => setIsMobileMenuOpen(false)} style={{ display: 'block', padding: '0.5rem', color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
                             {child.label}
                           </Link>
                        ))}
                      </div>
                    )}
                  </div>
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
      <main className="public-main-content">
        {children}
      </main>

      {/* Footer */}
      <footer className="portal-footer" style={{ background: themeColors?.nav || '#166534', color: 'white' }}>
        <div className="public-container">
          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', padding: '1.5rem 0' }}>
            
            {/* Column 1: Contact */}
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', color: 'white' }}>CONTACT</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
                {footerSettings?.contact?.phone && <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Phone size={16} /> <span>{footerSettings.contact.phone}</span></li>}
                {footerSettings?.contact?.email && <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Mail size={16} /> <span>{footerSettings.contact.email}</span></li>}
                {footerSettings?.contact?.officeHours && <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Clock size={16} /> <span>{footerSettings.contact.officeHours}</span></li>}
              </ul>
            </div>
            
            {/* Column 2: Quick Links */}
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', color: 'white' }}>QUICK LINKS</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                {footerSettings?.quickLinks?.filter(link => link.active).map(link => (
                  <li key={link.id}><Link to={link.url} className="footer-link" style={{ color: 'white', textDecoration: 'none' }}>{link.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Column 3: Social Media */}
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', color: 'white' }}>SOCIAL MEDIA</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {footerSettings?.socialMedia?.facebook && <a href={footerSettings.socialMedia.facebook} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>f</div></a>}
                {footerSettings?.socialMedia?.instagram && <a href={footerSettings.socialMedia.instagram} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>in</div></a>}
                {footerSettings?.socialMedia?.youtube && <a href={footerSettings.socialMedia.youtube} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>Y</div></a>}
                {footerSettings?.socialMedia?.linkedin && <a href={footerSettings.socialMedia.linkedin} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>in</div></a>}
                {footerSettings?.socialMedia?.twitter && <a href={footerSettings.socialMedia.twitter} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>X</div></a>}
              </div>
            </div>

            {/* Column 4: Find Us */}
            <div>
              <h3 style={{ fontWeight: '800', fontSize: '1.125rem', marginBottom: '1.5rem', color: 'white' }}>FIND US</h3>
              {footerSettings?.findUs?.address && (
                 <p style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '1rem', whiteSpace: 'pre-wrap', color: 'white' }}>
                   <MapPin size={16} style={{ flexShrink: 0, marginTop: '4px' }} />
                   <span>{footerSettings.findUs.address}</span>
                 </p>
              )}
              {footerSettings?.findUs?.stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem' }}>
                  {footerSettings.findUs.stats.split('|').map((stat, i) => (
                    <div key={i} style={{ fontSize: '0.85rem', fontWeight: '600' }}>{stat.trim()}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>
            <p style={{ fontWeight: '600', color: 'white' }}>{footerSettings?.legal?.affiliation || 'Affiliated to CISCE, New Delhi (WB046)'}</p>
            <p style={{ color: 'white' }}>{footerSettings?.legal?.copyright || '© 2026 SmartGrades School. All rights reserved.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
