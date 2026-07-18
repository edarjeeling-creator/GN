import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MapPin, Users, Phone, ArrowRight, FileText, CheckCircle, ChevronRight, Award, ImageIcon, Trophy, ChevronLeft, Shield, Megaphone, Bell, Calendar, Quote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SchoolPopup from '../components/SchoolPopup';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

const Home = () => {
  const [news, setNews] = useState([]);
  const [events, setEvents] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);

  const [heroStyle, setHeroStyle] = useState({
    title: 'Academic Excellence meets Future-Readiness.',
    subtitle: 'Nurturing minds, building character, and shaping leaders of tomorrow through holistic education and modern pedagogy.',
    titleColor: '#ffffff',
    subtitleColor: '#e2e8f0',
    btnPrimaryText: 'Our Divisions',
    btnPrimaryLink: '/academics',
    btnPrimaryColor: '#ffffff',
    btnPrimaryTextColor: '#0f172a',
    btnSecondaryText: 'Contact Us',
    btnSecondaryLink: '/contact',
    btnSecondaryColor: 'transparent',
    btnShape: '9999px', // Fully rounded by default
    overlayColor: '#0f172a',
    overlayOpacity: 0.8,
    stats: [
      { label: 'Years of Legacy', value: '30+' },
      { label: 'Pass Rate', value: '100%' },
      { label: 'Students', value: '2500+' },
      { label: 'Faculty Members', value: '150+' }
    ]
  });
  
  const [welcomeSection, setWelcomeSection] = useState({
    badge: 'A TRADITION OF EXCELLENCE',
    title: 'Welcome to Gyanoday Niketan',
    description: 'Welcome to a community of learners, thinkers, and innovators. At Gyanoday Niketan, we are committed to providing a holistic educational experience that nurtures the intellectual, social, and emotional growth of every student.',
    linkText: 'Read More',
    linkUrl: '/about'
  });

  const [leadershipMessage, setLeadershipMessage] = useState({
    badge: 'FROM THE DESK',
    title: 'A Message from Our Leadership',
    message: '"Our mission is to create a nurturing environment where students are inspired to achieve their full potential. We believe in academic excellence paired with character development, preparing our students not just for exams, but for life. Together, let us shape a brighter future for the next generation."',
    name: 'Dr. Principal Name',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600&h=600',
    btnText: 'Read Message',
    btnUrl: '/about'
  });

  const [divisions, setDivisions] = useState([
    { id: '1', title: 'Pre-Primary', description: 'Nurturing curiosity and foundational learning in a safe, play-based environment.', icon: 'Users', link: '/academics' },
    { id: '2', title: 'Primary', description: 'Building strong core academic skills and encouraging creative expression.', icon: 'BookOpen', link: '/academics' },
    { id: '3', title: 'Middle', description: 'Fostering exploration, critical thinking, and independent learning.', icon: 'Shield', link: '/academics' },
    { id: '4', title: 'Secondary', description: 'Preparing for board exams with focused academic rigor and mentorship.', icon: 'Award', link: '/academics' },
    { id: '5', title: 'Senior Secondary', description: 'Career readiness, specialized streams, and leadership development.', icon: 'Trophy', link: '/academics' }
  ]);
  
  const [whyChooseUs, setWhyChooseUs] = useState([
    { id: '1', title: 'Holistic Education', description: 'Focusing on academic, physical, and emotional development.', icon: 'Award' },
    { id: '2', title: 'Modern Infrastructure', description: 'State-of-the-art labs, libraries, and sports facilities.', icon: 'Shield' },
    { id: '3', title: 'Global Curriculum', description: 'Internationally recognized ICSE framework for future readiness.', icon: 'BookOpen' },
    { id: '4', title: 'Safe Environment', description: 'Secure campus with 24/7 CCTV surveillance and trained staff.', icon: 'CheckCircle' },
    { id: '5', title: 'Expert Faculty', description: 'Highly qualified and experienced educators dedicated to student success.', icon: 'Users' },
    { id: '6', title: 'Extra-curriculars', description: 'Wide range of sports, arts, and clubs for all-round development.', icon: 'Trophy' }
  ]);

  const [testimonials, setTestimonials] = useState([
    { id: '1', quote: "Gyanoday Niketan has transformed my child's approach to learning. The teachers are incredibly supportive.", author: "Parent of Class VIII student" },
    { id: '2', quote: "The balance between academics and extra-curricular activities here is unmatched. Proud to be an alumni.", author: "Alumni, Batch of 2020" }
  ]);

  const [ctaSection, setCtaSection] = useState({
    title: "Ready to Shape Your Child's Future?",
    description: "Join the Gyanoday Niketan family today and give your child the foundation they need to succeed.",
    btn1Text: "Apply Now",
    btn1Url: "/admissions",
    btn2Text: "Admission Policy",
    btn2Url: "/admissions"
  });

  const [gallery, setGallery] = useState([
    { id: '1', url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200' },
    { id: '2', url: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=600' },
    { id: '3', url: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=600' },
    { id: '4', url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=600' },
    { id: '5', url: 'https://images.unsplash.com/photo-1546410531-bea5aad14e00?auto=format&fit=crop&q=80&w=600' }
  ]);

  useEffect(() => {
    fetchNews();
    fetchEvents();
    fetchHeroSlides();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('key, value');
      if (!error && data) {
        data.forEach(item => {
          if (item.value) {
            const val = JSON.parse(item.value);
            switch (item.key) {
              case 'hero_styling': setHeroStyle(prev => ({ ...prev, ...val })); break;
              case 'welcome_section': setWelcomeSection(val); break;
              case 'leadership_message': setLeadershipMessage(val); break;
              case 'our_divisions': setDivisions(val); break;
              case 'why_choose_us': setWhyChooseUs(val); break;
              case 'testimonials': setTestimonials(val); break;
              case 'cta_section': setCtaSection(val); break;
              case 'gallery': setGallery(val.slice(0, 5)); break;
              default: break;
            }
          }
        });
      }
    } catch (e) {
      console.log('Settings fetch error:', e);
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
      const { data, error } = await supabase.from('news').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3);
      if (!error && data && data.length > 0) {
        setNews(data);
      } else {
        setNews([
          { id: 1, content: "Admissions open for 2026-2027 academic year. Apply now!", created_at: new Date().toISOString() },
          { id: 2, content: "Annual Sports Meet scheduled for next month. Check details.", created_at: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      console.log("News fetch error", err);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true }).limit(3);
      if (!error && data && data.length > 0) {
        setEvents(data);
      } else {
        setEvents([
          { id: 1, title: "Parent-Teacher Meeting", date: "2026-08-15", location: "Main Hall" },
          { id: 2, title: "Science Exhibition", date: "2026-09-05", location: "Science Block" },
          { id: 3, title: "Inter-School Debate", date: "2026-09-20", location: "Auditorium" },
        ]);
      }
    } catch (err) {
      console.log("Events fetch error", err);
    }
  };

  const iconMap = {
    Users: <Users className="w-6 h-6" />,
    BookOpen: <BookOpen className="w-6 h-6" />,
    Award: <Award className="w-6 h-6" />,
    FileText: <FileText className="w-6 h-6" />,
    Phone: <Phone className="w-6 h-6" />,
    CheckCircle: <CheckCircle className="w-6 h-6" />,
    Trophy: <Trophy className="w-6 h-6" />,
    ImageIcon: <ImageIcon className="w-6 h-6" />,
    Shield: <Shield className="w-6 h-6" />,
    Megaphone: <Megaphone className="w-6 h-6" />,
    Bell: <Bell className="w-6 h-6" />
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      
      {/* 1. Hero Section */}
      <div className="relative bg-slate-900 min-h-[80vh] flex flex-col items-center justify-center pt-20 pb-32">
        {/* Background Slider */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
                </motion.div>
              )
            )) : null}
          </AnimatePresence>
          {/* Dark blue overlay for text readability */}
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: heroStyle.overlayColor || '#0f172a', opacity: heroStyle.overlayOpacity ?? 0.8 }}></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm font-medium mb-8 backdrop-blur-md">
            <Award className="w-4 h-4 text-amber-400" /> {heroStyle.badge || 'A TRADITION OF EXCELLENCE'}
          </div>
          
          <p className="text-lg md:text-xl font-semibold tracking-wider mb-2 uppercase" style={{ color: heroStyle.subtitleColor }}>
            {heroStyle.subtitle}
          </p>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight">
            {heroStyle.title.includes('Future-Readiness') ? heroStyle.title.split('Future-Readiness').map((part, i, arr) => 
              <React.Fragment key={i}>
                <span style={{ color: heroStyle.titleColor }}>{part}</span>
                {i < arr.length - 1 && <span className="text-amber-400">Future-Readiness</span>}
              </React.Fragment>
            ) : (
              <span style={{ color: heroStyle.titleColor }}>{heroStyle.title}</span>
            )}
          </h1>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={heroStyle.btnPrimaryLink}>
              <Button className="h-14 px-8 text-base shadow-xl border-0 hover:bg-slate-200 transition-colors" style={{ backgroundColor: heroStyle.btnPrimaryColor, color: heroStyle.btnPrimaryTextColor, borderRadius: heroStyle.btnShape }}>
                {heroStyle.btnPrimaryText}
              </Button>
            </Link>
            <Link to={heroStyle.btnSecondaryLink}>
              <Button variant="outline" className="h-14 px-8 text-base bg-transparent border-white/30 text-white hover:bg-white/10 transition-colors" style={{ borderRadius: heroStyle.btnShape }}>
                {heroStyle.btnSecondaryText}
              </Button>
            </Link>
          </div>
        </div>

        {/* Floating Stats Bar */}
        <div className="absolute -bottom-16 left-4 right-4 z-20">
          <div className="max-w-6xl mx-auto bg-[#1e293b] rounded-2xl shadow-2xl p-8 border border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/10">
              {heroStyle.stats?.map((stat, idx) => (
                <div key={idx} className={`text-center ${idx > 0 ? 'pl-8' : ''}`}>
                  <div className="text-amber-400 mb-2">
                    <Trophy className="w-6 h-6 mx-auto" />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</h3>
                  <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-32 pb-20 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
        
        {/* 2. Welcome Section */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold mx-auto">
             {welcomeSection.badge}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{welcomeSection.title}</h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            {welcomeSection.description}
          </p>
          {welcomeSection.linkText && (
            <Link to={welcomeSection.linkUrl} className="inline-flex items-center font-semibold text-blue-700 hover:text-blue-800 transition-colors">
              {welcomeSection.linkText} <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>

        {/* 3. Leadership Message */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
          <div className="relative">
            <div className="aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden shadow-lg bg-slate-100">
              {leadershipMessage.imageUrl && <img loading="lazy" src={leadershipMessage.imageUrl} alt={leadershipMessage.name} className="w-full h-full object-cover" />}
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <Quote size={20} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Principal's Photo</p>
                <p className="text-xs text-slate-500">A Tradition of Excellence</p>
              </div>
            </div>
          </div>
          <div className="space-y-6 pl-0 lg:pl-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
              {leadershipMessage.badge}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{leadershipMessage.title}</h2>
            <div className="h-1 w-20 bg-amber-400 rounded-full"></div>
            <p className="text-lg text-slate-600 italic leading-relaxed">
              {leadershipMessage.message}
            </p>
            <div className="pt-4">
              <p className="font-bold text-slate-900 text-xl">{leadershipMessage.name}</p>
            </div>
            {leadershipMessage.btnText && (
              <Link to={leadershipMessage.btnUrl}>
                <Button className="bg-[#0f172a] hover:bg-[#1e293b] text-white mt-4 rounded-full px-6">
                  {leadershipMessage.btnText}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* 4. Academic Journey */}
        <div className="space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Academic Journey</h2>
            <p className="text-slate-600 text-lg">Nurturing growth through every phase of your child's education.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {divisions.map((div, idx) => (
              <Card key={idx} className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col bg-white">
                <CardContent className="p-6 flex flex-col h-full items-start">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                    {iconMap[div.icon] || <BookOpen />}
                  </div>
                  <h3 className="font-bold text-lg mb-3 text-slate-900">{div.title}</h3>
                  <p className="text-sm text-slate-600 flex-grow mb-6">{div.description}</p>
                  <Link to={div.link || '/academics'} className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mt-auto">
                    Learn More <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 5. Why Choose Us */}
        <div className="space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Why Choose Us</h2>
            <p className="text-slate-600 text-lg">A holistic approach to education that prepares your child for the future.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-start">
                <div className="w-12 h-12 rounded-xl bg-slate-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  {iconMap[item.icon] || <CheckCircle />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Life at Gyanoday Niketan (Gallery snippet) */}
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Life at Gyanoday Niketan</h2>
              <p className="text-slate-600 text-lg">Glimpses of our vibrant campus life</p>
            </div>
            <Link to="/gallery" className="inline-flex items-center font-semibold text-blue-700 hover:text-blue-800">
              View Gallery <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[400px] md:h-[500px]">
            {gallery.length > 0 && (
              <div className="h-full rounded-2xl overflow-hidden group">
                <img loading="lazy" src={gallery[0].url} alt="Campus Life" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 h-full">
              {gallery.slice(1, 5).map((img, idx) => (
                <div key={idx} className="rounded-2xl overflow-hidden group">
                  <img loading="lazy" src={img.url} alt={`Gallery ${idx+2}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 7. Latest News & Upcoming Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* News */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-slate-900">Latest News</h3>
              <Link to="/news" className="text-sm font-semibold text-blue-600">View All</Link>
            </div>
            <div className="space-y-4">
              {news.length > 0 ? news.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Megaphone className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">{item.content}</p>
                      <p className="text-xs text-slate-500 font-medium">{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-500">No news available at the moment.</div>
              )}
            </div>
          </div>

          {/* Events */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-slate-900">Upcoming Events</h3>
              <Link to="/events" className="text-sm font-semibold text-blue-600">View All</Link>
            </div>
            <div className="space-y-4">
              {events.length > 0 ? events.map(event => (
                <div key={event.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-xl bg-[#0f172a] text-white flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold uppercase">{new Date(event.date).toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{event.title}</h4>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {event.location || 'Campus'}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-500">No upcoming events scheduled.</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 8. Voices of Our Community (Testimonials) */}
      {testimonials.length > 0 && (
      <div className="bg-[#0f172a] py-24 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-white">
          <Quote size={200} />
        </div>
        <div className="absolute bottom-0 left-0 p-12 opacity-5 pointer-events-none text-white transform rotate-180">
          <Quote size={200} />
        </div>

        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">Voices of Our Community</h2>
          
          <div className="relative min-h-[200px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {testimonials.length > 0 && (
                <motion.div 
                  key={currentTestimonialIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <p className="text-xl md:text-2xl text-slate-300 italic leading-relaxed max-w-3xl mx-auto">
                    "{testimonials[currentTestimonialIndex].quote}"
                  </p>
                  <div>
                    <div className="w-12 h-1 bg-amber-400 mx-auto mb-4 rounded-full"></div>
                    <p className="font-bold text-white text-lg">{testimonials[currentTestimonialIndex].author}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Testimonial Nav */}
          {testimonials.length > 1 && (
            <div className="flex justify-center gap-2 mt-12">
              {testimonials.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={() => setCurrentTestimonialIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentTestimonialIndex ? 'bg-amber-400 w-6' : 'bg-slate-600 hover:bg-slate-400'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 9. CTA */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 -mt-16 mb-20 relative z-20">
        <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl p-10 md:p-16 shadow-xl flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm text-blue-600">
            <MapPin size={32} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{ctaSection.title}</h2>
          <p className="text-lg text-slate-700 max-w-2xl mb-10">
            {ctaSection.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to={ctaSection.btn1Url}>
              <Button className="h-12 px-8 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold w-full sm:w-auto">
                {ctaSection.btn1Text}
              </Button>
            </Link>
            <Link to={ctaSection.btn2Url}>
              <Button variant="outline" className="h-12 px-8 rounded-full bg-white/50 border-white shadow-sm hover:bg-white text-slate-800 font-semibold w-full sm:w-auto">
                {ctaSection.btn2Text}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <SchoolPopup />
    </div>
  );
};

export default Home;
