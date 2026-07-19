import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MapPin, Users, Phone, ArrowRight, FileText, CheckCircle, ChevronRight, Award, ImageIcon, Trophy, ChevronLeft, Shield, Megaphone, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SchoolPopup from '../components/SchoolPopup';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

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
    btnShape: '1rem'
  });
  
  const [academicExcellence, setAcademicExcellence] = useState([
    { id: '1', title: 'ICSE Results 2025', imageUrl: '', bgColor: '#fef3c7' },
    { id: '2', title: 'State Toppers', imageUrl: '', bgColor: '#dcfce7' },
    { id: '3', title: 'Top Achievements', imageUrl: '', bgColor: '#f1f5f9' }
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
  const [facilities, setFacilities] = useState([]);

  useEffect(() => {
    fetchNews();
    fetchHeroSlides();
    fetchHeroStyling();
    fetchAcademicExcellence();
    fetchDivisions();
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'campus_facilities').single();
      if (!error && data && data.value) setFacilities(JSON.parse(data.value));
    } catch (e) {
      console.log('Facilities fetch error:', e);
    }
  };

  const fetchHeroStyling = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'hero_styling').single();
      if (!error && data && data.value) setHeroStyle({ ...heroStyle, ...JSON.parse(data.value) });
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
        }
      }
    } catch (e) {
      console.log('Divisions fetch error:', e);
    }
  };

  const fetchAcademicExcellence = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'academic_excellence').single();
      if (!error && data && data.value) setAcademicExcellence(JSON.parse(data.value));
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
    }, 6000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase.from('news').select('*').eq('is_active', true).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setNews(data);
      } else {
        setNews([
          { id: 1, content: "🔔 ADMISSIONS OPEN FOR 2026-2027 ACADEMIC YEAR", created_at: new Date().toISOString() },
          { id: 2, content: "📅 MID-TERM EXAMS COMMENCE ON 15TH JUNE", created_at: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      console.log("News fetch error", err);
    }
  };

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

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: News */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-6">
            <Card className="border-t-4 border-t-brand-600 shadow-sm sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Megaphone className="text-brand-600" size={20} />
                  LATEST NEWS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {news.map((item, index) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}
                      key={item.id} 
                      className="flex gap-4 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                        <ImageIcon size={20} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-800 group-hover:text-brand-700 transition-colors leading-tight mb-1">{item.content}</h4>
                        <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CENTER COLUMN: Main Content */}
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-8">
            
            {/* Hero Slider */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-xl group min-h-[500px] sm:min-h-[600px] flex items-end">
              <AnimatePresence mode="sync">
                {heroSlides.length > 0 ? heroSlides.map((slide, index) => (
                  index === currentSlideIndex && (
                    <motion.div 
                      key={slide.id}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="absolute inset-0"
                    >
                      {slide.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video autoPlay muted loop playsInline className="w-full h-full object-cover" src={slide.media_url} />
                      ) : (
                        <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${slide.media_url})` }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                    </motion.div>
                  )
                )) : (
                  <div className="absolute inset-0">
                    <div className="w-full h-full bg-slate-800" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
                  </div>
                )}
              </AnimatePresence>

              {heroSlides.length > 1 && (
                <>
                  <button onClick={() => setCurrentSlideIndex(prev => prev === 0 ? heroSlides.length - 1 : prev - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30 border border-white/30 z-20">
                    <ChevronLeft size={24} />
                  </button>
                  <button onClick={() => setCurrentSlideIndex(prev => (prev + 1) % heroSlides.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30 border border-white/30 z-20">
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              <div className="relative z-10 p-6 sm:p-10 w-full">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-2" style={{ color: heroStyle.subtitleColor }}>{heroStyle.subtitle}</h2>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 tracking-tight leading-tight" style={{ color: heroStyle.titleColor }}>{heroStyle.title}</h1>
                  <p className="text-lg sm:text-xl max-w-2xl mb-8" style={{ color: heroStyle.titleColor, opacity: 0.9 }}>{heroStyle.description}</p>
                  <div className="flex flex-wrap gap-4">
                    <Link to={heroStyle.btnPrimaryLink}>
                      <Button className="h-12 px-8 text-base shadow-xl" style={{ backgroundColor: heroStyle.btnPrimaryColor, borderRadius: heroStyle.btnShape }}>
                        {heroStyle.btnPrimaryText} <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                    <Link to={heroStyle.btnSecondaryLink}>
                      <Button variant="outline" className="h-12 px-8 text-base bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20" style={{ borderRadius: heroStyle.btnShape }}>
                        {heroStyle.btnSecondaryText}
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Divisions */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{divisionsTitle}</h2>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {divisions.filter(c => !c.isPillar).map((card, idx) => (
                  <motion.div key={card.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}>
                    <Card hoverable className="h-full flex flex-col group border-slate-200">
                      <CardContent className="pt-6 flex flex-col flex-1 items-center text-center">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:-rotate-3" style={{ backgroundColor: card.bgColor }}>
                          {React.cloneElement(iconMap[card.icon] || <Users size={28} />, { color: card.color })}
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-800">{card.title}</h3>
                        <p className="text-sm text-slate-500 flex-1">{card.description}</p>
                        
                        {card.message && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="mt-4 w-full"
                            style={{ color: card.color }}
                            onClick={(e) => { e.preventDefault(); setSelectedDeskMessage(card); }}
                          >
                            Read Message <ChevronRight size={16} className="ml-1" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Admissions Process */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                <Award size={200} />
              </div>
              <CardContent className="p-8 sm:p-10 relative z-10">
                <h2 className="text-2xl font-bold mb-8">ADMISSIONS PROCESS</h2>
                
                <div className="flex flex-col sm:flex-row justify-between gap-6 relative">
                  <div className="hidden sm:block absolute top-6 left-12 right-12 h-0.5 bg-slate-700 z-0"></div>
                  
                  {[
                    { step: '1', title: 'Registration', desc: 'Online Inquiry', color: 'bg-brand-500' },
                    { step: '2', title: 'Interaction', desc: 'Entrance Test', color: 'bg-amber-500' },
                    { step: '3', title: 'Verification', desc: 'Documents', color: 'bg-emerald-500' },
                    { step: '✓', title: 'Admission', desc: 'Fee Payment', color: 'bg-green-600' }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-row sm:flex-col items-center gap-4 sm:gap-2 z-10 bg-slate-900 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${item.color}`}>
                        {item.step}
                      </div>
                      <div className="sm:text-center">
                        <h4 className="font-bold text-sm sm:text-base">{item.title}</h4>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* RIGHT COLUMN: Accolades & Disclosures */}
          <div className="lg:col-span-3 order-3 space-y-6">
            
            <Card className="border-t-4 border-t-amber-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Trophy className="text-amber-500" size={20} />
                  EXCELLENCE
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {academicExcellence.map((item, index) => (
                  <div key={item.id} className="relative group overflow-hidden rounded-xl bg-slate-100 aspect-video flex items-center justify-center cursor-pointer">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ backgroundColor: item.bgColor }}>
                        <Award size={32} className="opacity-50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-semibold text-sm leading-tight shadow-sm">{item.title}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-brand-50 border-brand-100 shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-4 text-brand-600">
                  <FileText size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Mandatory Disclosures</h3>
                <p className="text-sm text-slate-600 mb-6">View official compliance documents, affiliation certificates, and safety reports.</p>
                <Link to="/mandatory-disclosures">
                  <Button className="w-full">View Documents</Button>
                </Link>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
      
      <SchoolPopup />
    </div>
  );
};

export default Home;
