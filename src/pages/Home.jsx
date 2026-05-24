import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Trophy, ChevronRight } from 'lucide-react';
import '../public.css';

const Home = () => {
  return (
    <div style={{ width: '100%' }}>
      {/* Hero Section */}
      <section className="hero-section">
        
        {/* Animated Background Particles */}
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

        <div className="public-container" style={{ position: 'relative', zIndex: 10 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img src="/logo.png" alt="Logo" style={{ width: '8rem', height: '8rem', margin: '0 auto 2rem', filter: 'drop-shadow(0 25px 25px rgba(0,0,0,0.15))' }} />
            
            <h1 className="hero-title">
              Welcome to the <br/>
              <span className="text-gradient">
                Future of Education
              </span>
            </h1>
            
            <p className="hero-subtitle">
              A futuristic digital school campus — interactive, intelligent, secure, and visually unforgettable.
            </p>

            <div className="hero-buttons">
              <Link to="/admissions" className="btn-hero-primary">
                Apply Now <ArrowRight size={20} />
              </Link>
              <Link to="/login" className="btn-hero-outline">
                Student & Parent Portal
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Info Bar (Ticker) */}
      <div className="info-ticker">
        <motion.div 
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          className="ticker-content"
        >
          <span style={{ margin: '0 1rem' }}>🔔 ADMISSIONS OPEN FOR 2026-2027 ACADEMIC YEAR</span> • 
          <span style={{ margin: '0 1rem' }}>📅 MID-TERM EXAMS COMMENCE ON 15TH JUNE</span> • 
          <span style={{ margin: '0 1rem' }}>👥 PARENT-TEACHER MEETING SCHEDULED FOR FRIDAY</span>
        </motion.div>
      </div>

      {/* Bento Grid: Why Choose Us */}
      <section className="bento-section">
        <div className="public-container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 className="bento-title">Discover the Difference</h2>
            <p style={{ fontSize: '1.25rem', opacity: 0.8, maxWidth: '42rem', margin: '0 auto' }}>Experience a revolutionary approach to learning, tailored for the modern student.</p>
          </div>

          <div className="bento-grid">
            <motion.div 
              whileHover={{ y: -10 }}
              className="bento-card"
            >
              <div className="bento-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                <BookOpen size={28} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Academic Excellence</h3>
              <p style={{ opacity: 0.7 }}>Comprehensive curriculum designed to foster critical thinking and intellectual growth.</p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -10 }}
              className="bento-card bento-card-large"
            >
              <div style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.05, transform: 'translate(25%, 25%)' }}>
                 <Trophy size={200} />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <div className="bento-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                  <Trophy size={28} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Global Exposure & Innovation</h3>
                <p style={{ opacity: 0.7, maxWidth: '28rem' }}>Our state-of-the-art facilities and international partnerships prepare students for a rapidly evolving world.</p>
                <Link to="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', fontWeight: '600', color: '#059669' }}>
                  Read more <ChevronRight size={16} />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
