import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MapPin, Users, Phone, ArrowRight, FileText, CheckCircle, ChevronRight, Award, ImageIcon, Trophy, ChevronLeft, Shield, Megaphone, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SchoolPopup from '../components/SchoolPopup';
import '../public.css';

const Home = () => {
  const [news, setNews] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [heroStyle, setHeroStyle] = useState({
    title: 'HIMALAYAN ICSE SCHOOL',
    subtitle: 'WELCOME TO',
    description: 'Nurturing Minds, Building Futures | K-12 Excellence | Est. 1996',
    titleColor: '#ffffff',
    subtitleColor: '#fcd34d',
    btnPrimaryText: 'ADMISSIONS OPEN (2026-27)',
    btnPrimaryLink: '/admissions',
    btnPrimaryColor: '#f59e0b',
    btnSecondaryText: 'EXPLORE ACADEMICS',
    btnSecondaryLink: '/academics',
    btnSecondaryColor: '#166534',
    btnShape: '2rem'
  });
  const [academicExcellence, setAcademicExcellence] = useState([
    { id: '1', title: 'ICSE Results 2025', imageUrl: '', bgColor: '#fef3c7' },
    { id: '2', title: 'State Toppers', imageUrl: '', bgColor: '#dcfce7' },
    { id: '3', title: 'Top Student Achievements', imageUrl: '', bgColor: '#f1f5f9' }
  ]);
  const [divisions, setDivisions] = useState([
    { id: '1', title: 'Kindergarten', description: 'Sensory and foundational learning.', icon: 'Users', color: '#d97706', bgColor: '#fef3c7' },
    { id: '2', title: 'Primary', description: 'Building strong core academic skills.', icon: 'BookOpen', color: '#ea580c', bgColor: '#ffedd5' },
    { id: '3', title: 'Middle', description: 'Exploration and critical thinking.', icon: 'Users', color: '#16a34a', bgColor: '#dcfce7' },
    { id: '4', title: 'Senior School', description: 'Career readiness and leadership.', icon: 'Award', color: '#2563eb', bgColor: '#dbeafe' }
  ]);
  const [selectedDeskMessage, setSelectedDeskMessage] = useState(null);
  const [divisionsTitle, setDivisionsTitle] = useState("OUR DIVISIONS");
  const [pillarsTitle, setPillarsTitle] = useState("OUR PILLARS");

  useEffect(() => {
    fetchNews();
    fetchHeroSlides();
    fetchHeroStyling();
    fetchAcademicExcellence();
    fetchDivisions();
  }, []);

  const fetchHeroStyling = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'hero_styling').single();
      if (!error && data && data.value) {
        setHeroStyle({ ...heroStyle, ...JSON.parse(data.value) });
      }
    } catch (e) {
      console.log('Hero styling fetch error:', e);
    }
  };

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'our_divisions').single();
      if (!error && data && data.value) {
        const parsed = JSON.parse(data.value);
        if (parsed && parsed.cards && Array.isArray(parsed.cards)) {
          setDivisions(parsed.cards);
          setDivisionsTitle(parsed.divisionsTitle || "OUR DIVISIONS");
          setPillarsTitle(parsed.pillarsTitle || "OUR PILLARS");
        } else if (Array.isArray(parsed)) {
          setDivisions(parsed);
          setDivisionsTitle("OUR DIVISIONS");
          setPillarsTitle("OUR PILLARS");
        }
      }
    } catch (e) {
      console.log('Divisions fetch error:', e);
    }
  };

  const fetchAcademicExcellence = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'academic_excellence').single();
      if (!error && data && data.value) {
        setAcademicExcellence(JSON.parse(data.value));
      }
    } catch (e) {
      console.log('Academic Excellence fetch error:', e);
    }
  };

  const fetchHeroSlides = async () => {
    try {
      const { data, error } = await supabase.from('hero_slides').select('*').order('created_at', { ascending: false });
      if (!error && data) setHeroSlides(data);
    } catch (e) {
      console.log('Hero slides fetch error:', e);
    }
  };

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (!error && data && data.length > 0) {
        setNews(data);
      } else {
        // Fallback default news if table doesn't exist or is empty
        setNews([
          { id: 1, content: "🔔 ADMISSIONS OPEN FOR 2026-2027 ACADEMIC YEAR" },
          { id: 2, content: "📅 MID-TERM EXAMS COMMENCE ON 15TH JUNE" },
          { id: 3, content: "👥 PARENT-TEACHER MEETING SCHEDULED FOR FRIDAY" }
        ]);
      }
    } catch (err) {
      setNews([
        { id: 1, content: "🔔 ADMISSIONS OPEN FOR 2026-2027 ACADEMIC YEAR" },
        { id: 2, content: "📅 MID-TERM EXAMS COMMENCE ON 15TH JUNE" },
        { id: 3, content: "👥 PARENT-TEACHER MEETING SCHEDULED FOR FRIDAY" }
      ]);
    }
  };

  return (
    <div style={{ width: '100%', background: '#f8fafc' }}>
      <div className="portal-main-wrapper">
        
        {/* LEFT COLUMN */}
        <div className="portal-sidebar-left">
          
          {/* LATEST NEWS & EVENTS Widget */}
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', borderBottom: '2px solid #166534', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#1f2937' }}>
              LATEST NEWS & EVENTS
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
              {news.map((item, index) => (
                <div key={item.id} className="news-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '0.5rem', background: '#e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <ImageIcon size={24} color="#94a3b8" />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1f2937', marginBottom: '0.25rem' }}>{item.content}</h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(item.created_at || Date.now() - index * 86400000).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 1rem', borderRadius: '1rem', fontSize: '0.8rem', color: '#475569' }}>Scroll ↓</button>
            </div>
          </div>

        </div>

        {/* CENTER COLUMN */}
        <div className="portal-center-content">
          
          {/* Hero Banner */}
          <div className="portal-hero" style={{ position: 'relative', overflow: 'hidden', backgroundColor: 'black' }}>
            {heroSlides.length > 0 ? (
              heroSlides.map((slide, index) => (
                <div 
                  key={slide.id} 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    opacity: index === currentSlideIndex ? 1 : 0, 
                    transition: 'opacity 1s ease-in-out',
                    zIndex: 0 
                  }}
                >
                  {slide.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={slide.media_url} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${slide.media_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  )}
                </div>
              ))
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url(/hero_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
            )}
            
            {/* Nav Arrows if multiple slides */}
            {heroSlides.length > 1 && (
              <>
                <button 
                  onClick={() => setCurrentSlideIndex(prev => prev === 0 ? heroSlides.length - 1 : prev - 1)}
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={() => setCurrentSlideIndex(prev => (prev + 1) % heroSlides.length)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >
                  <ChevronRight size={24} />
                </button>

                {/* Dots */}
                <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', gap: '0.5rem' }}>
                  {heroSlides.map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setCurrentSlideIndex(i)}
                      style={{ width: '10px', height: '10px', borderRadius: '50%', background: i === currentSlideIndex ? 'white' : 'rgba(255,255,255,0.4)', border: 'none', padding: 0, cursor: 'pointer', transition: 'background 0.3s' }}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="portal-hero-overlay" style={{ position: 'relative', zIndex: 1, padding: '2rem 1rem 4rem 1rem' }}>
              <h2 className="hero-subtitle" style={{ marginBottom: '0.5rem', color: heroStyle.subtitleColor, fontWeight: '600' }}>{heroStyle.subtitle}</h2>
              <h1 className="hero-title" style={{ marginBottom: '1rem', color: heroStyle.titleColor }}>{heroStyle.title}</h1>
              <p style={{ fontSize: 'clamp(1rem, 3vw, 1.2rem)', marginBottom: '2rem', opacity: 0.9, color: heroStyle.titleColor, maxWidth: '600px', margin: '0 auto 2rem' }}>{heroStyle.description}</p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link to={heroStyle.btnPrimaryLink} className="btn-hero-primary" style={{ background: heroStyle.btnPrimaryColor, color: 'white', border: 'none', borderRadius: heroStyle.btnShape }}>{heroStyle.btnPrimaryText}</Link>
                <Link to={heroStyle.btnSecondaryLink} className="btn-hero-outline" style={{ border: '2px solid white', background: heroStyle.btnSecondaryColor, color: 'white', borderRadius: heroStyle.btnShape }}>{heroStyle.btnSecondaryText}</Link>
              </div>
            </div>
          </div>

          {/* Our Divisions Section */}
          <div style={{ padding: '0 1rem' }}>
            <h2 className="portal-section-title">{divisionsTitle}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {divisions.filter(c => !c.isPillar).map((card) => {
                const iconMap = {
                  Users: <Users size={32} />,
                  BookOpen: <BookOpen size={32} />,
                  Award: <Award size={32} />,
                  FileText: <FileText size={32} />,
                  Phone: <Phone size={32} />,
                  CheckCircle: <CheckCircle size={32} />,
                  Trophy: <Trophy size={32} />,
                  ImageIcon: <ImageIcon size={32} />,
                  Shield: <Shield size={32} />,
                  Megaphone: <Megaphone size={32} />,
                  Bell: <Bell size={32} />
                };
                
                const iconElement = iconMap[card.icon] || <Users size={32} />;
                const coloredIcon = React.cloneElement(iconElement, { color: card.color });
                
                return (
                  <div key={card.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '220px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: card.bgColor || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      {coloredIcon}
                    </div>
                    <h3 style={{ fontWeight: '800', marginBottom: '0.5rem', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{card.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', flexGrow: 1, margin: 0 }}>{card.description}</p>
                    
                    {card.message && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedDeskMessage(card);
                        }}
                        style={{ 
                          marginTop: '1rem', 
                          padding: '0.5rem 1rem', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold', 
                          background: card.color || '#3b82f6', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '0.5rem', 
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        Read Desk Message
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Our Pillars Section (Only rendered if leadership cards exist) */}
          {divisions.some(c => c.isPillar) && (
            <div style={{ padding: '2rem 1rem 0' }}>
              <h2 className="portal-section-title">{pillarsTitle}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {divisions.filter(c => c.isPillar).map((card) => {
                  const iconMap = {
                    Users: <Users size={32} />,
                    BookOpen: <BookOpen size={32} />,
                    Award: <Award size={32} />,
                    FileText: <FileText size={32} />,
                    Phone: <Phone size={32} />,
                    CheckCircle: <CheckCircle size={32} />,
                    Trophy: <Trophy size={32} />,
                    ImageIcon: <ImageIcon size={32} />,
                    Shield: <Shield size={32} />,
                    Megaphone: <Megaphone size={32} />,
                    Bell: <Bell size={32} />
                  };
                  
                  const iconElement = iconMap[card.icon] || <Users size={32} />;
                  const coloredIcon = React.cloneElement(iconElement, { color: card.color });
                  
                  return (
                    <div key={card.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '220px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: card.bgColor || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        {coloredIcon}
                      </div>
                      <h3 style={{ fontWeight: '800', marginBottom: '0.5rem', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{card.title}</h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', flexGrow: 1, margin: 0 }}>{card.description}</p>
                      
                      {card.message && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDeskMessage(card);
                          }}
                          style={{ 
                            marginTop: '1rem', 
                            padding: '0.5rem 1rem', 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold', 
                            background: card.color || '#3b82f6', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '0.5rem', 
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          Read Desk Message
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campus Facilities */}
          <div>
            <h2 className="portal-section-title">CAMPUS FACILITIES</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="facility-card">
                <img src="/facility_library.png" alt="Library" />
                <div className="facility-card-title">Library</div>
              </div>
              <div className="facility-card">
                <img src="/facility_science.png" alt="Science Labs" />
                <div className="facility-card-title">Science Labs</div>
              </div>
              <div className="facility-card">
                <img src="/facility_sports.png" alt="Sports Field" />
                <div className="facility-card-title">Sports Field</div>
              </div>
            </div>
          </div>

          {/* Admissions Process */}
          <div style={{ background: '#fdfbf7', padding: '2rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
            <h2 className="portal-section-title">ADMISSIONS PROCESS & GUIDELINES</h2>
            
            <div className="process-flowchart">
              <div className="process-step">
                <div className="process-circle" style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>1</div>
                <h4 style={{ fontWeight: '800', fontSize: '0.9rem' }}>STEP 1</h4>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Registration & Inquiry</p>
              </div>
              <ArrowRight className="process-arrow" />
              <div className="process-step">
                <div className="process-circle" style={{ borderColor: '#f59e0b', background: '#f59e0b', color: 'white' }}>2</div>
                <h4 style={{ fontWeight: '800', fontSize: '0.9rem' }}>STEP 2</h4>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Interaction / Entrance Test</p>
              </div>
              <ArrowRight className="process-arrow" />
              <div className="process-step">
                <div className="process-circle" style={{ borderColor: '#10b981', color: '#10b981' }}>3</div>
                <h4 style={{ fontWeight: '800', fontSize: '0.9rem' }}>STEP 3</h4>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Document Verification</p>
              </div>
              <ArrowRight className="process-arrow" />
              <div className="process-step">
                <div className="process-circle" style={{ borderColor: '#166534', background: '#166534', color: 'white' }}>✓</div>
                <h4 style={{ fontWeight: '800', fontSize: '0.9rem' }}>ADMISSION</h4>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Fee Payment & Enrollment</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              <div>
                <h4 style={{ fontWeight: '800', marginBottom: '1rem' }}>FORMS</h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <li style={{ color: '#d97706', textDecoration: 'underline' }}>Admission Form (PDF)</li>
                  <li style={{ color: '#d97706', textDecoration: 'underline' }}>Medical History Form</li>
                  <li style={{ color: '#d97706', textDecoration: 'underline' }}>Transport Form</li>
                </ul>
                
                <h4 style={{ fontWeight: '800', marginTop: '1.5rem', marginBottom: '1rem' }}>AGE CRITERIA</h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                  <li>Nursery: 3 - 4 years</li>
                  <li>LKG: 4 - 5 years</li>
                  <li>UKG: 5 - 6 years</li>
                  <li>Class 1: 6+ years</li>
                </ul>
              </div>
              
              <div>
                <h4 style={{ fontWeight: '800', marginBottom: '1rem' }}>DOCUMENT CHECKLIST</h4>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                  <li style={{ display: 'flex', gap: '0.5rem' }}><CheckCircle size={16} color="#10b981"/> Birth Certificate</li>
                  <li style={{ display: 'flex', gap: '0.5rem' }}><CheckCircle size={16} color="#10b981"/> Passport size photos</li>
                  <li style={{ display: 'flex', gap: '0.5rem' }}><CheckCircle size={16} color="#10b981"/> Previous Report Card</li>
                  <li style={{ display: 'flex', gap: '0.5rem' }}><CheckCircle size={16} color="#10b981"/> Transfer Certificate (TC)</li>
                  <li style={{ display: 'flex', gap: '0.5rem' }}><CheckCircle size={16} color="#10b981"/> Aadhar Card Copy</li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="portal-sidebar-right">
          
          {/* Academic Excellence */}
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', borderBottom: '2px solid #166534', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#1f2937' }}>
              ACADEMIC EXCELLENCE
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                {academicExcellence[0].imageUrl ? (
                  <img src={academicExcellence[0].imageUrl} alt={academicExcellence[0].title} style={{ width: '100%', aspectRatio: '1', borderRadius: '0.5rem', objectFit: 'cover', marginBottom: '0.5rem' }} />
                ) : (
                  <div style={{ background: academicExcellence[0].bgColor, width: '100%', aspectRatio: '1', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <Award size={40} color="#d97706" />
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', fontWeight: '700' }}>{academicExcellence[0].title}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                {academicExcellence[1].imageUrl ? (
                  <img src={academicExcellence[1].imageUrl} alt={academicExcellence[1].title} style={{ width: '100%', aspectRatio: '1', borderRadius: '0.5rem', objectFit: 'cover', marginBottom: '0.5rem' }} />
                ) : (
                  <div style={{ background: academicExcellence[1].bgColor, width: '100%', aspectRatio: '1', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <Trophy size={40} color="#16a34a" />
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', fontWeight: '700' }}>{academicExcellence[1].title}</p>
              </div>
              <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                {academicExcellence[2].imageUrl ? (
                  <img src={academicExcellence[2].imageUrl} alt={academicExcellence[2].title} style={{ width: '100%', height: '100px', borderRadius: '0.5rem', objectFit: 'cover', marginBottom: '0.5rem' }} />
                ) : (
                  <div style={{ background: academicExcellence[2].bgColor, width: '100%', height: '100px', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <Users size={32} color="#64748b" />
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', fontWeight: '700' }}>{academicExcellence[2].title}</p>
              </div>
            </div>
          </div>

          {/* Mandatory Disclosures */}
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', borderBottom: '2px solid #166534', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#1f2937' }}>
              MANDATORY DISCLOSURES
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>View our official compliance documents, affiliation certificates, safety reports, and committee details.</p>
              <Link to="/mandatory-disclosures" className="btn-hero-primary" style={{ background: '#f59e0b', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                <FileText size={18} /> View All Disclosures
              </Link>
            </div>
          </div>

        </div>

      </div>
      {selectedDeskMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999999, padding: '1.5rem' }} onClick={() => setSelectedDeskMessage(null)}>
          <div style={{ backgroundColor: 'white', border: `2px solid ${selectedDeskMessage.color}`, borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', width: '100%', maxWidth: '600px', padding: '2rem', boxSizing: 'border-box', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedDeskMessage(null)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(15,23,42,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
            >
              &times;
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: selectedDeskMessage.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(() => {
                  const iconMap = {
                    Users: <Users size={28} />,
                    BookOpen: <BookOpen size={28} />,
                    Award: <Award size={28} />,
                    FileText: <FileText size={28} />,
                    Phone: <Phone size={28} />,
                    CheckCircle: <CheckCircle size={28} />,
                    Trophy: <Trophy size={28} />,
                    ImageIcon: <ImageIcon size={28} />,
                    Shield: <Shield size={28} />,
                    Megaphone: <Megaphone size={28} />,
                    Bell: <Bell size={28} />
                  };
                  return React.cloneElement(iconMap[selectedDeskMessage.icon] || <Users size={28} />, { color: selectedDeskMessage.color });
                })()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{selectedDeskMessage.title}</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campus Message Desk</span>
              </div>
            </div>
            <div style={{ color: '#334155', fontSize: '0.95rem', lineHeight: '1.6', overflowY: 'auto', maxHeight: '350px', paddingRight: '0.5rem', whiteSpace: 'pre-wrap' }}>
              {selectedDeskMessage.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setSelectedDeskMessage(null)}
                style={{ padding: '0.625rem 1.5rem', fontSize: '0.875rem', fontWeight: 'bold', background: selectedDeskMessage.color, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              >
                Close Message
              </button>
            </div>
          </div>
        </div>
      )}
      <SchoolPopup />
    </div>
  );
};

export default Home;
