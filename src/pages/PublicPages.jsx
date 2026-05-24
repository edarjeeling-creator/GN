import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, MapPin, Mail, Phone, Clock, Award, Target, Star, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3.5rem' }}>About Our School</h1>
            <p className="hero-subtitle" style={{ marginBottom: 0 }}>Nurturing minds, building futures.</p>
          </motion.div>
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
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    studentName: '',
    dob: '',
    grade: '',
    gender: '',
    parentName: '',
    phone: '',
    email: '',
    address: '',
    prevSchool: '',
    lastGrade: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => setStep(s => Math.min(4, s + 1));
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 2000);
  };

  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #065f46, #047857)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Admissions Portal</h1>
            <p className="hero-subtitle">Application for 2026-2027 Academic Year</p>
          </motion.div>
        </div>
      </div>
      
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '60vh' }}>
        <div className="bento-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {isSuccess ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ width: '80px', height: '80px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'white' }}>
                <Award size={40} />
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-public)', marginBottom: '1rem' }}>Application Received!</h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Thank you for applying to SmartGrades. We have successfully received your application.
              </p>
              <div style={{ background: 'var(--bg-public)', padding: '1.5rem', borderRadius: '1rem', display: 'inline-block', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Application Reference ID</p>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', fontFamily: 'monospace' }}>APP-2026-{Math.floor(Math.random() * 9000) + 1000}</p>
              </div>
              <p style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>Our admissions team will contact you shortly.</p>
            </motion.div>
          ) : (
            <>
              <div className="step-indicator">
                <div className={`step-item ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
                <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>2</div>
                <div className={`step-item ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>3</div>
                <div className={`step-item ${step >= 4 ? 'active' : ''}`}>4</div>
              </div>

              <form onSubmit={step === 4 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
                <AnimatePresence mode="wait">
                  
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-public)' }}>Student Information</h3>
                      <div className="form-group">
                        <label className="form-label">Full Name of Student *</label>
                        <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                          <label className="form-label">Date of Birth *</label>
                          <input type="date" name="dob" value={formData.dob} onChange={handleChange} required className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Gender</label>
                          <select name="gender" value={formData.gender} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }}>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Grade Applying For *</label>
                        <select name="grade" value={formData.grade} onChange={handleChange} required className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }}>
                          <option value="">Select Grade</option>
                          {[...Array(12)].map((_, i) => (
                            <option key={i+1} value={`Grade ${i+1}`}>Grade {i+1}</option>
                          ))}
                        </select>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-public)' }}>Parent/Guardian Details</h3>
                      <div className="form-group">
                        <label className="form-label">Primary Contact Name *</label>
                        <input type="text" name="parentName" value={formData.parentName} onChange={handleChange} required className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                          <label className="form-label">Phone Number *</label>
                          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email Address *</label>
                          <input type="email" name="email" value={formData.email} onChange={handleChange} required className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Residential Address</label>
                        <textarea name="address" value={formData.address} onChange={handleChange} rows="3" className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)', resize: 'vertical' }}></textarea>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-public)' }}>Academic History</h3>
                      <div className="form-group">
                        <label className="form-label">Previous School Attended</label>
                        <input type="text" name="prevSchool" value={formData.prevSchool} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last Grade Completed</label>
                        <input type="text" name="lastGrade" value={formData.lastGrade} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-public)', color: 'var(--text-public)' }} />
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-public)' }}>Review & Submit</h3>
                      <div style={{ background: 'var(--bg-public)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Student Name:</span>
                          <span style={{ color: 'var(--text-public)', fontWeight: '600' }}>{formData.studentName || '-'}</span>
                          
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Grade Applying For:</span>
                          <span style={{ color: 'var(--text-public)', fontWeight: '600' }}>{formData.grade || '-'}</span>
                          
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Parent/Guardian:</span>
                          <span style={{ color: 'var(--text-public)', fontWeight: '600' }}>{formData.parentName || '-'}</span>
                          
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Contact Email:</span>
                          <span style={{ color: 'var(--text-public)', fontWeight: '600' }}>{formData.email || '-'}</span>
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>By submitting this application, you declare that all information provided is true and accurate to the best of your knowledge.</p>
                    </motion.div>
                  )}
                  
                </AnimatePresence>

                <div className="form-actions">
                  {step > 1 ? (
                    <button type="button" onClick={prevStep} className="btn-hero-outline" style={{ border: '2px solid var(--border-color)', color: 'var(--text-public)', padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
                      Back
                    </button>
                  ) : <div></div>}
                  
                  {step < 4 ? (
                    <button type="submit" className="btn-hero-primary" style={{ background: 'var(--primary-color)', color: 'white', boxShadow: 'none', padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
                      Next Step
                    </button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="btn-hero-primary" style={{ background: '#10b981', color: 'white', boxShadow: 'none', padding: '0.75rem 1.5rem', fontSize: '1rem', opacity: isSubmitting ? 0.7 : 1 }}>
                      {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const Faculty = () => {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFaculty();
  }, []);

  const fetchFaculty = async () => {
    try {
      const { data, error } = await supabase
        .from('faculty')
        .select('*')
        .order('name', { ascending: true });
        
      if (!error && data) {
        setFaculty(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #4c1d95, #6d28d9)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Our Faculty</h1>
            <p className="hero-subtitle" style={{ marginBottom: 0 }}>Passionate educators shaping the future.</p>
          </motion.div>
        </div>
      </div>
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '40vh' }}>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Loading faculty profiles...</div>
        ) : faculty.length === 0 ? (
           <div style={{ textAlign: 'center', marginTop: '2rem' }}>
             <Users size={48} style={{ margin: '0 auto', color: '#8b5cf6', opacity: 0.5 }} />
             <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem', color: 'var(--text-public)' }}>Profiles Coming Soon</h2>
             <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto' }}>
               We are currently updating our faculty directory. Please check back soon!
             </p>
           </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem' }}>
            {faculty.map((member, index) => (
              <motion.div 
                key={member.id} 
                initial={{ opacity: 0, y: 20 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                style={{ 
                  background: 'var(--surface-color)', 
                  borderRadius: '1rem', 
                  overflow: 'hidden', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  width: '100%',
                  maxWidth: '300px'
                }}
              >
                <div style={{ height: '200px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {member.image_url ? (
                    <img src={member.image_url} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ImageIcon size={48} color="#94a3b8" />
                  )}
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{member.name}</h3>
                  <div style={{ color: '#6d28d9', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{member.designation}</div>
                  <div style={{ display: 'inline-block', background: '#f3f4f6', color: '#475569', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                    {member.department}
                  </div>
                  {member.bio && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      {member.bio}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
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

export const Gallery = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setPhotos(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(photos.map(p => p.category))];
  const filteredPhotos = activeCategory === 'All' ? photos : photos.filter(p => p.category === activeCategory);

  const isVideo = (url) => url && url.match(/\.(mp4|webm|ogg)$/i);

  const currentIndex = selectedMedia ? filteredPhotos.findIndex(p => p.id === selectedMedia.id) : -1;

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) setSelectedMedia(filteredPhotos[currentIndex - 1]);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < filteredPhotos.length - 1) setSelectedMedia(filteredPhotos[currentIndex + 1]);
  };

  return (
    <div className="w-full relative">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #047857, #10b981)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Photo & Video Gallery</h1>
            <p className="hero-subtitle" style={{ marginBottom: 0 }}>Glimpses of campus life and events.</p>
          </motion.div>
        </div>
      </div>
      
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '50vh' }}>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Loading gallery...</div>
        ) : photos.length === 0 ? (
           <div style={{ textAlign: 'center', marginTop: '2rem' }}>
             <ImageIcon size={48} style={{ margin: '0 auto', color: '#10b981', opacity: 0.5 }} />
             <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem', color: 'var(--text-public)' }}>Gallery Empty</h2>
             <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto' }}>
               We are currently uploading our collection. Please check back soon!
             </p>
           </div>
        ) : (
          <>
            {/* Category Filter */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3rem' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '0.5rem 1.5rem',
                    borderRadius: '2rem',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: activeCategory === cat ? '#10b981' : '#f1f5f9',
                    color: activeCategory === cat ? 'white' : '#475569',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Uniform Structured Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <AnimatePresence mode="popLayout">
                {filteredPhotos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      position: 'relative',
                      borderRadius: '1rem',
                      overflow: 'hidden',
                      aspectRatio: '1',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      cursor: 'pointer'
                    }}
                    className="gallery-item-hover"
                    onClick={() => setSelectedMedia(photo)}
                  >
                    {isVideo(photo.image_url) ? (
                      <video src={photo.image_url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src={photo.image_url} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    
                    <div className="gallery-item-overlay" style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                      padding: '2rem 1rem 1rem',
                      color: 'white',
                      pointerEvents: 'none'
                    }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', fontWeight: 'bold', marginBottom: '0.25rem' }}>{photo.category}</div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{photo.title}</h3>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Lightbox Modal for Gallery */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMedia(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              backdropFilter: 'blur(10px)'
            }}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}
              style={{
                position: 'absolute',
                top: '2rem',
                right: '2rem',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000
              }}
            >
              &times;
            </button>

            {currentIndex > 0 && (
              <button 
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  left: '2rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                  backdropFilter: 'blur(4px)'
                }}
              >
                <ChevronLeft size={32} />
              </button>
            )}

            {currentIndex < filteredPhotos.length - 1 && (
              <button 
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  right: '2rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                  backdropFilter: 'blur(4px)'
                }}
              >
                <ChevronRight size={32} />
              </button>
            )}

            <motion.div 
              key={selectedMedia.id}
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()} 
              style={{ position: 'relative', maxWidth: '100%', maxHeight: '90vh' }}
            >
              {isVideo(selectedMedia.image_url) ? (
                <video src={selectedMedia.image_url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '0.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
              ) : (
                <img src={selectedMedia.image_url} alt={selectedMedia.title} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '0.5rem', objectFit: 'contain', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
              )}
              <div style={{ marginTop: '1rem', textAlign: 'center', color: 'white' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedMedia.title}</h2>
                <p style={{ color: '#10b981', fontWeight: 'bold', marginTop: '0.25rem' }}>{selectedMedia.category}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
