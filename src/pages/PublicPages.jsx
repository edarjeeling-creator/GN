import { motion } from 'framer-motion';
import { BookOpen, Users, MapPin, Mail, Phone, Clock, Award, Target, Star } from 'lucide-react';
import '../public.css';

// Reusable animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export const About = () => {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="hero-section" style={{ minHeight: '40vh', paddingTop: '6rem' }}>
        <div className="public-container relative z-10 text-center">
          <motion.initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3.5rem' }}>About Our School</h1>
            <p className="hero-subtitle" style={{ marginBottom: 0 }}>Nurturing minds, building futures.</p>
          </motion.initial>
        </div>
      </div>

      <div className="public-container" style={{ padding: '4rem 1rem' }}>
        <div className="bento-grid">
          
          {/* Principal's Message */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card bento-card-large" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="bento-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', marginBottom: 0 }}>
              <Star size={28} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-public)' }}>Principal's Message</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.1rem' }}>
              "Welcome to a place where tradition meets innovation. Our commitment is not just to academic excellence, but to the holistic development of every student who walks through our doors. We believe in empowering our students with the skills, values, and vision needed to thrive in a rapidly changing world."
            </p>
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-public)' }}>Dr. Jane Doe</p>
              <p style={{ color: 'var(--primary-color)', fontWeight: '500' }}>Principal</p>
            </div>
          </motion.div>

          {/* Vision & Mission */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card" style={{ background: 'var(--primary-color)', color: 'white' }}>
            <div className="bento-icon-wrapper" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
              <Target size={28} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1rem' }}>Our Vision</h2>
            <p style={{ lineHeight: 1.6, opacity: 0.9, marginBottom: '2rem' }}>
              To be a global center of learning that fosters innovation, ethical leadership, and a lifelong passion for knowledge.
            </p>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1rem' }}>Our Mission</h2>
            <p style={{ lineHeight: 1.6, opacity: 0.9 }}>
              To provide a dynamic and inclusive educational environment that challenges students to reach their highest potential.
            </p>
          </motion.div>

          {/* Stats/Highlights */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--primary-color)', marginBottom: '0.5rem' }}>25+</h3>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Years of Excellence</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ fontSize: '3rem', fontWeight: '900', color: '#10b981', marginBottom: '0.5rem' }}>100%</h3>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Board Result Success</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ fontSize: '3rem', fontWeight: '900', color: '#a855f7', marginBottom: '0.5rem' }}>50+</h3>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Expert Faculty Members</p>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export const Academics = () => {
  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #0f172a, #1e40af)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Academics & Curriculum</h1>
          </motion.div>
        </div>
      </div>
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Award size={48} style={{ margin: '0 auto', color: 'var(--primary-color)', opacity: 0.5 }} />
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: 'var(--text-public)' }}>Excellence in Education</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto' }}>
            Our curriculum is designed to challenge students and foster a lifelong love of learning. Detailed syllabus and academic calendars will be published here shortly.
          </p>
        </div>
      </div>
    </div>
  );
};

export const Admissions = () => {
  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #065f46, #047857)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Admissions Portal</h1>
          </motion.div>
        </div>
      </div>
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '40vh' }}>
        <div className="bento-card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <Users size={48} style={{ margin: '0 auto 1rem', color: '#059669' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Join Our Campus</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>The online admission forms for the 2026-2027 academic year are currently being updated.</p>
          <button className="btn-hero-primary" style={{ margin: '0 auto', background: '#059669', color: 'white', boxShadow: 'none' }}>Notify Me When Open</button>
        </div>
      </div>
    </div>
  );
};

export const Faculty = () => {
  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #4c1d95, #6d28d9)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Our Faculty</h1>
          </motion.div>
        </div>
      </div>
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <BookOpen size={48} style={{ margin: '0 auto', color: '#8b5cf6', opacity: 0.5 }} />
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: 'var(--text-public)' }}>Meet the Experts</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto' }}>
            Our dedicated team of educators brings decades of experience and passion to the classroom. Faculty profiles are being digitized.
          </p>
        </div>
      </div>
    </div>
  );
};

export const Contact = () => {
  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #be123c, #e11d48)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Contact Us</h1>
          </motion.div>
        </div>
      </div>
      
      <div className="public-container" style={{ padding: '4rem 1rem' }}>
        <div className="bento-grid">
          
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card bento-card-large">
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: 'var(--text-public)' }}>Get In Touch</h2>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <input type="text" placeholder="Your Name" className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                <input type="email" placeholder="Your Email" className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
              </div>
              <input type="text" placeholder="Subject" className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
              <textarea placeholder="Your Message" rows="5" className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)', resize: 'vertical' }}></textarea>
              <button type="button" className="btn-hero-primary" style={{ background: '#e11d48', color: 'white', alignSelf: 'flex-start', boxShadow: 'none' }}>
                Send Message
              </button>
            </form>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bento-card" style={{ background: '#111827', color: 'white' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem' }}>Contact Info</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <MapPin style={{ color: '#e11d48', marginTop: '0.25rem' }} />
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Address</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>123 Education Lane<br/>Digital Campus<br/>Tech City, TC 12345</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Phone style={{ color: '#e11d48' }} />
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Phone</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>+1 (555) 123-4567</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Mail style={{ color: '#e11d48' }} />
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Email</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>contact@smartgrades.edu</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <Clock style={{ color: '#e11d48', marginTop: '0.25rem' }} />
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Office Hours</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Mon - Fri: 8:00 AM - 4:00 PM<br/>Sat - Sun: Closed</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};
