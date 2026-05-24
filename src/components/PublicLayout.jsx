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
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      {/* Top Navbar */}
      <nav className="fixed w-full z-50 transition-all duration-300" style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Area */}
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="SmartGrades Logo" className="h-12 w-12 object-contain" />
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight" style={{ color: 'var(--primary-color)' }}>SmartGrades</span>
                <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">School Campus</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <NavLink 
                  key={link.name} 
                  to={link.path}
                  className={({ isActive }) => `font-medium text-sm transition-colors hover:text-[var(--primary-color)] ${isActive ? 'text-[var(--primary-color)] font-semibold' : 'text-gray-700'}`}
                >
                  {link.name}
                </NavLink>
              ))}
            </div>

            {/* Right Actions */}
            <div className="hidden md:flex items-center space-x-4">
              <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <Link to="/login" className="px-5 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105" style={{ background: 'var(--primary-color)', color: 'white' }}>
                Login Portal
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md text-gray-700 hover:text-black">
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
              className="md:hidden bg-white border-b border-gray-200 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-800 hover:bg-gray-50 hover:text-[var(--primary-color)]"
                  >
                    {link.name}
                  </NavLink>
                ))}
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-4">
                  <button onClick={toggleDarkMode} className="flex items-center gap-2 px-3 py-2 text-gray-700">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />} Toggle Theme
                  </button>
                  <Link to="/login" className="block text-center w-full px-5 py-3 rounded-md font-semibold text-white" style={{ background: 'var(--primary-color)' }}>
                    Login Portal
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow pt-20" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src="/logo.png" alt="SmartGrades Logo" className="h-10 w-10 brightness-0 invert" />
                <span className="font-bold text-xl tracking-tight">SmartGrades</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Empowering the next generation with a futuristic digital campus. Interactive, intelligent, secure, and visually unforgettable.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-6">Quick Links</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/admissions" className="hover:text-white transition-colors">Admissions</Link></li>
                <li><Link to="/academics" className="hover:text-white transition-colors">Academics</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-6">Portals</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/login" className="hover:text-white transition-colors">Student Login</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Parent Portal</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Teacher Dashboard</Link></li>
                <li><Link to="/result" className="hover:text-white transition-colors">Result Portal</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-6">Contact Us</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li>📍 123 Education Lane, Digital City</li>
                <li>📞 +1 (555) 123-4567</li>
                <li>✉️ contact@smartgrades.edu</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} SmartGrades School. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="#" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
