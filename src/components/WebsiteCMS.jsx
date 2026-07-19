import React, { useState, useEffect, useRef } from 'react';
import IconPicker from './IconPicker';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Image as ImageIcon, Users, UploadCloud, Loader2, Monitor, Palette, Layout, List, ArrowUp, ArrowDown, Edit2, CheckCircle2, FileText, Megaphone } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';

export default function WebsiteCMS() {
  const { isReadOnly, allowedTeachers } = useSubscription();
  const [cmsSection, setCmsSection] = useState('general');
  
  // News State
  const [news, setNews] = useState([]);
  const [newNewsContent, setNewNewsContent] = useState('');
  
  const [faculty, setFaculty] = useState([]);
  const [gallery, setGallery] = useState([]);
  
  // Faculty State
  const [newFaculty, setNewFaculty] = useState({ name: '', designation: '', department: '', bio: '' });
  const [facultyFile, setFacultyFile] = useState(null);
  const [uploadingFaculty, setUploadingFaculty] = useState(false);
  const facultyFileRef = useRef(null);

  // Gallery State
  const [gallerySectionTitle, setGallerySectionTitle] = useState("Life at Gyanoday Niketan");
  const [gallerySectionSubtitle, setGallerySectionSubtitle] = useState("Glimpses of our vibrant campus life");
  const [galleryCategory, setGalleryCategory] = useState('');
  const [galleryYear, setGalleryYear] = useState(new Date().getFullYear().toString());
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState({ current: 0, total: 0 });
  const galleryFileRef = useRef(null);

  // Hero State
  const [heroSlides, setHeroSlides] = useState([]);
  const [heroFiles, setHeroFiles] = useState([]);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroFileRef = useRef(null);
  
  // Hero Styling State
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
    btnShape: '2rem', // rounded-full default
    stats: [
      { label: 'Years of Legacy', value: '30+' },
      { label: 'Pass Rate', value: '100%' },
      { label: 'Students', value: '2500+' },
      { label: 'Faculty Members', value: '150+' }
    ]
  });
  const [savingHeroStyle, setSavingHeroStyle] = useState(false);

  // Site Branding State (v2)
  const [siteBranding, setSiteBranding] = useState({
    siteName: 'SMARTGRADES ICSE SCHOOL',
    siteMotto: '',
    logoUrl: '/logo.png',
    faviconUrl: '/vite.svg'
  });
  const [savingSiteBranding, setSavingSiteBranding] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const logoFileRef = useRef(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const faviconFileRef = useRef(null);

  // Theme Colors State
  const [themeColors, setThemeColors] = useState({
    heading: '#0f172a',
    body: '#64748b',
    button: '#2563eb',
    nav: '#1f2937',
    footer: '#e5e7eb',
    link: '#2563eb',
    hover: '#1d4ed8'
  });
  const [savingThemeColors, setSavingThemeColors] = useState(false);

  // Footer Settings State
  const [footerSettings, setFooterSettings] = useState({
    contact: { phone: '+91 XXXXX XXXXX', alternatePhone: '', email: 'info@smartgrades.edu.in', admissionContact: '', officeHours: 'Mon–Fri: 8:00 AM – 4:00 PM' },
    quickLinks: [
      { id: '1', label: 'Home', url: '/', active: true },
      { id: '2', label: 'About Us', url: '/about', active: true },
      { id: '3', label: 'Admissions', url: '/admissions', active: true },
      { id: '4', label: 'Academics', url: '/academics', active: true },
      { id: '5', label: 'Notices', url: '/notices', active: true },
      { id: '6', label: 'Contact Us', url: '/contact', active: true }
    ],
    socialMedia: { facebook: '', instagram: '', youtube: '', linkedin: '', twitter: '' },
    findUs: { address: 'SmartGrades ICSE School\nDarjeeling / West Bengal', landmark: '', pinCode: '', stats: '1200+ Students | 75+ Teachers | 98% Results | 25 Years of Excellence' },
    legal: { affiliation: 'Affiliated to CISCE, New Delhi (WB046)', copyright: '© 2026 SmartGrades School. All rights reserved.' }
  });
  const [savingFooterSettings, setSavingFooterSettings] = useState(false);

  // Menu Builder State
  const [mainMenu, setMainMenu] = useState([]);
  const [savingMenu, setSavingMenu] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);

  // Academic Excellence State
  const [academicExcellence, setAcademicExcellence] = useState([
    { id: '1', title: 'ICSE Results 2025', imageUrl: '', bgColor: '#fef3c7' },
    { id: '2', title: 'State Toppers', imageUrl: '', bgColor: '#dcfce7' },
    { id: '3', title: 'Top Student Achievements', imageUrl: '', bgColor: '#f1f5f9' }
  ]);
  const [savingAcademicExcellence, setSavingAcademicExcellence] = useState(false);
  const [aeFiles, setAeFiles] = useState({ '1': null, '2': null, '3': null });
  const aeRef1 = useRef(null);
  const aeRef2 = useRef(null);
  const aeRef3 = useRef(null);

  // Mandatory Disclosures State
  const [mandatoryDisclosures, setMandatoryDisclosures] = useState([]);
  const [savingDisclosures, setSavingDisclosures] = useState(false);
  const [newDisclosure, setNewDisclosure] = useState({
    title: '',
    category: 'Legal',
    order: 1,
    isActive: true
  });
  const disclosureFileRef = useRef(null);
  const disclosureCategories = ['Legal', 'Safety', 'Academic', 'Administrative', 'PTA/SMC', 'Others'];

  // Campaign Pop-Up Notice State
  const [popupConfig, setPopupConfig] = useState({
    enabled: false,
    category: 'admission', // 'emergency', 'admission', 'event'
    title: 'Admissions Open 2026-27',
    description: 'Join the premier ICSE Institution in Darjeeling. Watch our campus virtual tour and apply today!',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    buttonLabel: 'Apply Online',
    buttonUrl: '/admissions'
  });
  const [savingPopupConfig, setSavingPopupConfig] = useState(false);
  const [uploadingPopupVideo, setUploadingPopupVideo] = useState(false);


  // New CMS States for Redesign
  const [welcomeSection, setWelcomeSection] = useState({ 
    badge: 'A TRADITION OF EXCELLENCE', 
    title: 'Welcome to Gyanoday Niketan', 
    description: 'Welcome to a community of learners, thinkers, and innovators. At Gyanoday Niketan, we are committed to providing a holistic educational experience that nurtures the intellectual, social, and emotional growth of every student.', 
    linkText: 'Read More', 
    linkUrl: '/about' 
  });
  const [leadershipFile, setLeadershipFile] = useState(null);
  const leadershipFileRef = useRef(null);
  const [leadershipMessage, setLeadershipMessage] = useState({ 
    badge: 'LEADERSHIP', 
    title: 'Message from the Principal', 
    message: 'Education is not just about academic excellence; it is about character building, compassion, and continuous growth. Our mission is to empower every student to reach their highest potential in a rapidly changing world.', 
    name: 'Dr. John Doe', 
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80', 
    btnText: 'Read Full Message', 
    btnUrl: '/principal-desk' 
  });
  const [whyChooseUs, setWhyChooseUs] = useState([]);
  const [whyChooseUsTitle, setWhyChooseUsTitle] = useState("Why Choose Us");
  const [whyChooseUsSubtitle, setWhyChooseUsSubtitle] = useState("A holistic approach to education that prepares your child for the future.");
  const [whyChooseUsEnabled, setWhyChooseUsEnabled] = useState(true);
  const [testimonials, setTestimonials] = useState([]);
  const [ctaSection, setCtaSection] = useState({ 
    title: 'Ready to Join Our Community?', 
    description: 'Take the first step towards a brighter future. Admissions for the upcoming academic year are now open.', 
    btn1Text: 'Apply Now', 
    btn1Url: '/admissions', 
    btn2Text: 'Contact Us', 
    btn2Url: '/contact' 
  });
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', location: '' });
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [savingLeadership, setSavingLeadership] = useState(false);
  const [savingWhyChooseUs, setSavingWhyChooseUs] = useState(false);
  const [savingTestimonials, setSavingTestimonials] = useState(false);
  const [savingCta, setSavingCta] = useState(false);

  // Our Divisions & Campus Desks State
  const [divisions, setDivisions] = useState([]);
  const [savingDivisions, setSavingDivisions] = useState(false);
  const [divisionsTitle, setDivisionsTitle] = useState("Academic Journey");
  const [divisionsSubtitle, setDivisionsSubtitle] = useState("Nurturing growth through every phase of your child's education.");
  const [divisionsEnabled, setDivisionsEnabled] = useState(true);
  const [pillarsTitle, setPillarsTitle] = useState("OUR PILLARS");

  // Campus Facilities State
  const [facilities, setFacilities] = useState([]);
  const [savingFacilities, setSavingFacilities] = useState(false);
  const [facilityFiles, setFacilityFiles] = useState({});

  useEffect(() => {
    fetchNews();
    fetchWelcomeSection();
    fetchLeadershipMessage();
    fetchWhyChooseUs();
    fetchTestimonials();
    fetchCtaSection();
    fetchEvents();
    fetchFaculty();
    fetchGallery();
    fetchGallerySectionText();
    fetchHeroSlides();
    fetchHeroStyling();
    fetchSiteBranding();
    fetchThemeColors();
    fetchFooterSettings();
    fetchMainMenu();
    fetchAcademicExcellence();
    fetchMandatoryDisclosures();
    fetchPopupConfig();
    fetchDivisions();
    fetchFacilities();
  }, []);


  const fetchWelcomeSection = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'welcome_section').single();
    if (data && data.value) setWelcomeSection(JSON.parse(data.value));
  };
  const saveWelcomeSection = async (e) => {
    if(e) e.preventDefault(); setSavingWelcome(true);
    await supabase.from('site_settings').upsert({ key: 'welcome_section', value: JSON.stringify(welcomeSection) }, { onConflict: 'key,school_id' });
    setSavingWelcome(false); alert("Welcome section saved!");
  };

  const fetchLeadershipMessage = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'leadership_message').single();
    if (data && data.value) setLeadershipMessage(JSON.parse(data.value));
  };
  const saveLeadershipMessage = async (e) => {
    if(e) e.preventDefault(); setSavingLeadership(true);
    try {
      let currentImageUrl = leadershipMessage.imageUrl;
      if (leadershipFile) {
        // Upload new file
        const fileExt = leadershipFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `leadership/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('public-assets').upload(filePath, leadershipFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
        
        // Delete old file if exists and starts with our storage URL
        if (currentImageUrl && currentImageUrl.includes('/public-assets/leadership/')) {
          const oldFilePath = currentImageUrl.split('/public-assets/')[1];
          if (oldFilePath) {
            await supabase.storage.from('public-assets').remove([oldFilePath]).catch(console.error);
          }
        }
        currentImageUrl = data.publicUrl;
      }
      
      const newMsg = { ...leadershipMessage, imageUrl: currentImageUrl };
      await supabase.from('site_settings').upsert({ key: 'leadership_message', value: JSON.stringify(newMsg) }, { onConflict: 'key,school_id' });
      setLeadershipMessage(newMsg);
      setLeadershipFile(null);
      if (leadershipFileRef.current) leadershipFileRef.current.value = '';
      alert("Leadership message saved!");
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSavingLeadership(false);
    }
  };

  const fetchWhyChooseUs = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'why_choose_us').single();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (parsed.cards) {
        setWhyChooseUs(parsed.cards);
        setWhyChooseUsTitle(parsed.title || "Why Choose Us");
        setWhyChooseUsSubtitle(parsed.subtitle || "A holistic approach to education that prepares your child for the future.");
        setWhyChooseUsEnabled(parsed.enabled !== false);
      } else if (Array.isArray(parsed)) {
        setWhyChooseUs(parsed);
      }
    } else {
      setWhyChooseUs([
        { title: 'Holistic Education', description: 'Focusing on academic, physical, and emotional development.', icon: 'Award', color: '#3b82f6', isActive: true },
        { title: 'Modern Infrastructure', description: 'State-of-the-art labs, libraries, and sports facilities.', icon: 'Shield', color: '#10b981', isActive: true },
        { title: 'Global Curriculum', description: 'Internationally recognized ICSE framework for future readiness.', icon: 'Globe', color: '#8b5cf6', isActive: true },
        { title: 'Safe Environment', description: 'Secure campus with 24/7 CCTV surveillance and trained staff.', icon: 'CheckCircle', color: '#f59e0b', isActive: true },
        { title: 'Expert Faculty', description: 'Highly qualified and experienced educators dedicated to student success.', icon: 'Users', color: '#ec4899', isActive: true },
        { title: 'Extra-curriculars', description: 'Wide range of sports, arts, and clubs for all-round development.', icon: 'Trophy', color: '#0ea5e9', isActive: true }
      ]);
    }
  };
  
  const saveWhyChooseUs = async (e) => {
    if(e) e.preventDefault(); setSavingWhyChooseUs(true);
    const payload = {
      title: whyChooseUsTitle,
      subtitle: whyChooseUsSubtitle,
      enabled: whyChooseUsEnabled,
      cards: whyChooseUs
    };
    await supabase.from('site_settings').upsert({ key: 'why_choose_us', value: JSON.stringify(payload) }, { onConflict: 'key,school_id' });
    setSavingWhyChooseUs(false); alert("Why Choose Us saved!");
  };

  const fetchTestimonials = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'testimonials').single();
    if (data && data.value) setTestimonials(JSON.parse(data.value));
  };
  const saveTestimonials = async (e) => {
    if(e) e.preventDefault(); setSavingTestimonials(true);
    await supabase.from('site_settings').upsert({ key: 'testimonials', value: JSON.stringify(testimonials) }, { onConflict: 'key,school_id' });
    setSavingTestimonials(false); alert("Testimonials saved!");
  };

  const fetchCtaSection = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'cta_section').single();
    if (data && data.value) setCtaSection(JSON.parse(data.value));
  };
  const saveCtaSection = async (e) => {
    if(e) e.preventDefault(); setSavingCta(true);
    await supabase.from('site_settings').upsert({ key: 'cta_section', value: JSON.stringify(ctaSection) }, { onConflict: 'key,school_id' });
    setSavingCta(false); alert("CTA Section saved!");
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data) setEvents(data);
  };
  const handleAddEvent = async (e) => {
    if(e) e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;
    await supabase.from('events').insert([newEvent]);
    setNewEvent({ title: '', date: '', location: '' });
    fetchEvents();
  };
  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Delete event?")) return;
    await supabase.from('events').delete().match({ id });
    fetchEvents();
  };

  const fetchNews = async () => {
    const { data, error } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setNews(data);
    }
  };

  const handleAddNews = async (e) => {
    e.preventDefault();
    if (!newNewsContent) return;
    const { error } = await supabase.from('news').insert([{ content: newNewsContent, is_active: true }]);
    if (!error) {
      setNewNewsContent('');
      fetchNews();
    } else {
      alert("Error adding news: " + error.message);
    }
  };

  const handleDeleteNews = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    const { error } = await supabase.from('news').delete().match({ id });
    if (!error) fetchNews();
    else alert("Error deleting news: " + error.message);
  };

  const handleToggleNews = async (id, currentStatus) => {
    const { error } = await supabase.from('news').update({ is_active: !currentStatus }).match({ id });
    if (!error) fetchNews();
    else alert("Error updating news: " + error.message);
  };

  const fetchFacilities = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'campus_facilities').single();
    if (data && data.value) {
      setFacilities(JSON.parse(data.value));
    } else {
      setFacilities([
        { id: '1', title: 'Library', imageUrl: '/facility_library.png' },
        { id: '2', title: 'Science Labs', imageUrl: '/facility_science.png' },
        { id: '3', title: 'Sports Field', imageUrl: '/facility_sports.png' }
      ]);
    }
  };

  const saveFacilities = async (e) => {
    if (e) e.preventDefault();
    setSavingFacilities(true);
    try {
      const updated = [...facilities];
      for (let i = 0; i < updated.length; i++) {
        const file = facilityFiles[updated[i].id];
        if (file) {
          updated[i].imageUrl = await uploadFileToSupabase(file, 'facilities');
        }
      }
      const { error } = await supabase.from('site_settings').upsert({ key: 'campus_facilities', value: JSON.stringify(updated) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      setFacilities(updated);
      setFacilityFiles({});
      alert("Campus Facilities saved successfully!");
    } catch (err) {
      alert("Failed to save facilities: " + err.message);
    } finally {
      setSavingFacilities(false);
    }
  };

  const handleAddFacility = () => {
    setFacilities([
      ...facilities,
      {
        id: Date.now().toString(),
        title: 'New Facility',
        imageUrl: '/facility_library.png'
      }
    ]);
  };

  const handleDeleteFacility = (id) => {
    if (!window.confirm("Are you sure you want to delete this facility card?")) return;
    setFacilities(facilities.filter(f => f.id !== id));
    const nextFiles = { ...facilityFiles };
    delete nextFiles[id];
    setFacilityFiles(nextFiles);
  };

  const fetchPopupConfig = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'active_homepage_popup').single();
    if (data && data.value) {
      setPopupConfig(JSON.parse(data.value));
    }
  };

  const fetchDivisions = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'our_divisions').single();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && parsed.cards && Array.isArray(parsed.cards)) {
        setDivisions(parsed.cards);
        setDivisionsTitle(parsed.divisionsTitle || "Academic Journey");
        setDivisionsSubtitle(parsed.divisionsSubtitle || "Nurturing growth through every phase of your child's education.");
        setDivisionsEnabled(parsed.enabled !== false);
      } else if (Array.isArray(parsed)) {
        setDivisions(parsed);
        setDivisionsTitle("Academic Journey");
        setDivisionsSubtitle("Nurturing growth through every phase of your child's education.");
      }
    } else {
      setDivisions([
        { id: '1', title: 'Pre-Primary', description: 'Sensory and foundational learning.', icon: 'Users', link: '/academics', isActive: true },
        { id: '2', title: 'Primary', description: 'Building strong core academic skills.', icon: 'BookOpen', link: '/academics', isActive: true },
        { id: '3', title: 'Middle', description: 'Exploration and critical thinking.', icon: 'Compass', link: '/academics', isActive: true },
        { id: '4', title: 'Secondary', description: 'Career readiness and leadership.', icon: 'Award', link: '/academics', isActive: true }
      ]);
      setDivisionsTitle("Academic Journey");
      setDivisionsSubtitle("Nurturing growth through every phase of your child's education.");
    }
  };

  const saveDivisions = async (e) => {
    if (e) e.preventDefault();
    setSavingDivisions(true);
    try {
      const payload = {
        divisionsTitle,
        divisionsSubtitle,
        enabled: divisionsEnabled,
        cards: divisions
      };
      const { error } = await supabase.from('site_settings').upsert({ key: 'our_divisions', value: JSON.stringify(payload) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Academic Journey saved successfully!");
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingDivisions(false);
    }
  };



  const savePopupConfig = async (e) => {
    e.preventDefault();
    setSavingPopupConfig(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'active_homepage_popup', value: JSON.stringify(popupConfig) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Homepage Pop-up campaign notice saved successfully!");
    } catch (err) {
      alert("Failed to save pop-up config: " + err.message);
    } finally {
      setSavingPopupConfig(false);
    }
  };

  const fetchHeroStyling = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'hero_styling').single();
    if (data && data.value) {
      setHeroStyle(prev => ({...prev, ...JSON.parse(data.value)}));
    }
  };

  const saveHeroStyling = async (e) => {
    e.preventDefault();
    setSavingHeroStyle(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'hero_styling', value: JSON.stringify(heroStyle) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Hero styling saved successfully!");
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingHeroStyle(false);
    }
  };

  const fetchSiteBranding = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'site_branding_v2').single();
    if (data && data.value) {
      setSiteBranding(JSON.parse(data.value));
    }
  };

  const saveSiteBranding = async (e) => {
    e.preventDefault();
    setSavingSiteBranding(true);
    try {
      let currentLogoUrl = siteBranding.logoUrl;
      if (logoFile) {
        currentLogoUrl = await uploadFileToSupabase(logoFile, 'branding');
      }

      let currentFaviconUrl = siteBranding.faviconUrl;
      if (faviconFile) {
        currentFaviconUrl = await uploadFileToSupabase(faviconFile, 'branding');
      }
      
      const newBranding = { ...siteBranding, logoUrl: currentLogoUrl, faviconUrl: currentFaviconUrl };
      
      const { error } = await supabase.from('site_settings').upsert({ key: 'site_branding_v2', value: JSON.stringify(newBranding) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      
      setSiteBranding(newBranding);
      setLogoFile(null);
      if (logoFileRef.current) logoFileRef.current.value = '';
      setFaviconFile(null);
      if (faviconFileRef.current) faviconFileRef.current.value = '';
      
      alert("Site branding saved successfully!");
      // Force reload to apply changes via ThemeProvider if desired, but user can refresh manually
    } catch (err) {
      alert("Failed to save site branding: " + err.message);
    } finally {
      setSavingSiteBranding(false);
    }
  };

  const fetchThemeColors = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'theme_colors').single();
    if (data && data.value) {
      setThemeColors(JSON.parse(data.value));
    }
  };

  const saveThemeColors = async (e) => {
    e.preventDefault();
    setSavingThemeColors(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'theme_colors', value: JSON.stringify(themeColors) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Theme colors saved successfully!");
    } catch (err) {
      alert("Failed to save theme colors: " + err.message);
    } finally {
      setSavingThemeColors(false);
    }
  };

  const fetchFooterSettings = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'footer_settings').single();
    if (data && data.value) {
      setFooterSettings(JSON.parse(data.value));
    }
  };

  const fetchMainMenu = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'main_navigation').single();
    if (data && data.value) {
      setMainMenu(JSON.parse(data.value));
    } else {
      setMainMenu([
        { id: '1', label: 'ABOUT US', url: '/about', type: 'simple', isActive: true, children: [] },
        { id: '2', label: 'FACULTY', url: '/faculty', type: 'simple', isActive: true, children: [] },
        { id: '3', label: 'ACADEMICS', url: '/academics', type: 'simple', isActive: true, children: [] },
        { id: '4', label: 'ADMISSIONS', url: '/admissions', type: 'simple', isActive: true, children: [] },
        { id: '5', label: 'GALLERY', url: '/gallery', type: 'simple', isActive: true, children: [] },
        { id: '6', label: 'NOTICES/CIRCULARS', url: '/notices', type: 'simple', isActive: true, children: [] },
        { id: '7', label: 'CONTACT US', url: '/contact', type: 'simple', isActive: true, children: [] }
      ]);
    }
  };

  const saveFooterSettings = async (e) => {
    if(e) e.preventDefault();
    setSavingFooterSettings(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'footer_settings', value: JSON.stringify(footerSettings) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Footer settings saved successfully!");
    } catch (err) {
      alert("Failed to save footer settings: " + err.message);
    } finally {
      setSavingFooterSettings(false);
    }
  };

  const saveMainMenu = async () => {
    setSavingMenu(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'main_navigation', value: JSON.stringify(mainMenu) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Main menu saved successfully!");
    } catch (err) {
      alert("Failed to save menu: " + err.message);
    } finally {
      setSavingMenu(false);
    }
  };

  const fetchAcademicExcellence = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'academic_excellence').single();
    if (data && data.value) {
      setAcademicExcellence(JSON.parse(data.value));
    }
  };

  const saveAcademicExcellence = async (e) => {
    e.preventDefault();
    setSavingAcademicExcellence(true);
    try {
      const updatedAE = [...academicExcellence];
      for (let i = 0; i < updatedAE.length; i++) {
        const file = aeFiles[updatedAE[i].id];
        if (file) {
          updatedAE[i].imageUrl = await uploadFileToSupabase(file, 'academic_excellence');
        }
      }
      
      const { error } = await supabase.from('site_settings').upsert({ key: 'academic_excellence', value: JSON.stringify(updatedAE) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      
      setAcademicExcellence(updatedAE);
      setAeFiles({ '1': null, '2': null, '3': null });
      if(aeRef1.current) aeRef1.current.value = '';
      if(aeRef2.current) aeRef2.current.value = '';
      if(aeRef3.current) aeRef3.current.value = '';
      
      alert("Academic Excellence settings saved successfully!");
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingAcademicExcellence(false);
    }
  };

  const fetchMandatoryDisclosures = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'mandatory_disclosures').single();
    if (data && data.value) {
      setMandatoryDisclosures(JSON.parse(data.value));
    }
  };

  const saveNewDisclosure = async (e) => {
    e.preventDefault();
    if (!disclosureFileRef.current.files[0]) {
      alert("Please select a file to upload.");
      return;
    }
    setSavingDisclosures(true);
    try {
      const fileUrl = await uploadFileToSupabase(disclosureFileRef.current.files[0], 'disclosures');
      
      const newDoc = {
        id: Date.now().toString(),
        title: newDisclosure.title,
        category: newDisclosure.category,
        order: parseInt(newDisclosure.order, 10),
        isActive: newDisclosure.isActive,
        fileUrl: fileUrl,
        created_at: new Date().toISOString()
      };
      
      const updatedList = [...mandatoryDisclosures, newDoc];
      
      const { error } = await supabase.from('site_settings').upsert({ key: 'mandatory_disclosures', value: JSON.stringify(updatedList) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      
      setMandatoryDisclosures(updatedList);
      setNewDisclosure({ title: '', category: 'Legal', order: 1, isActive: true });
      disclosureFileRef.current.value = '';
      alert("Disclosure document added successfully!");
    } catch (err) {
      alert("Failed to save disclosure: " + err.message);
    } finally {
      setSavingDisclosures(false);
    }
  };

  const toggleDisclosureActive = async (id) => {
    const updatedList = mandatoryDisclosures.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d);
    setMandatoryDisclosures(updatedList);
    await supabase.from('site_settings').upsert({ key: 'mandatory_disclosures', value: JSON.stringify(updatedList) }, { onConflict: 'key,school_id' });
  };

  const deleteDisclosure = async (id) => {
    if(!window.confirm("Delete this document?")) return;
    const updatedList = mandatoryDisclosures.filter(d => d.id !== id);
    setMandatoryDisclosures(updatedList);
    await supabase.from('site_settings').upsert({ key: 'mandatory_disclosures', value: JSON.stringify(updatedList) }, { onConflict: 'key,school_id' });
  };

  const updateMenu = (newMenu) => setMainMenu([...newMenu]);

  const addMenuItem = () => {
    updateMenu([...mainMenu, { id: Date.now().toString(), label: 'New Item', url: '/', type: 'simple', isActive: true, children: [] }]);
  };

  const deleteMenuItem = (id, parentId = null) => {
    if (!window.confirm("Delete this menu item?")) return;
    if (parentId) {
      const parent = mainMenu.find(m => m.id === parentId);
      if(parent) {
        parent.children = parent.children.filter(c => c.id !== id);
        updateMenu(mainMenu);
      }
    } else {
      updateMenu(mainMenu.filter(m => m.id !== id));
    }
  };

  const moveMenuItem = (index, direction, parentId = null) => {
    const list = parentId ? mainMenu.find(m => m.id === parentId).children : mainMenu;
    if (direction === 'up' && index > 0) {
      const temp = list[index - 1];
      list[index - 1] = list[index];
      list[index] = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index + 1];
      list[index + 1] = list[index];
      list[index] = temp;
    }
    updateMenu(mainMenu);
  };

  const addSubItem = (parentId) => {
    const parent = mainMenu.find(m => m.id === parentId);
    if(parent) {
      if(!parent.children) parent.children = [];
      parent.children.push({ id: Date.now().toString(), label: 'New Sub-item', url: '/', type: 'simple', isActive: true });
      parent.type = 'dropdown'; // automatically make it a dropdown if it has children
      updateMenu(mainMenu);
    }
  };

  const saveEditedItem = (updatedItem, parentId, index) => {
    const list = parentId ? mainMenu.find(m => m.id === parentId).children : mainMenu;
    list[index] = updatedItem;
    updateMenu(mainMenu);
    setEditingMenuItem(null);
  };

  const resetBranding = async () => {
    if (!window.confirm("Are you sure you want to reset branding to default?")) return;
    setSiteBranding({ siteName: 'SMARTGRADES ICSE SCHOOL', siteMotto: '', logoUrl: '/logo.png', faviconUrl: '/vite.svg' });
  };

  const applyPreset = (preset) => {
    switch (preset) {
      case 'School Green':
        setThemeColors({ heading: '#166534', body: '#334155', button: '#ffffff', nav: '#166534', footer: '#9ca3af', link: '#15803d', hover: '#16a34a' });
        break;
      case 'Classic White':
        setThemeColors({ heading: '#0f172a', body: '#475569', button: '#ffffff', nav: '#0f172a', footer: '#64748b', link: '#0f172a', hover: '#334155' });
        break;
      case 'Modern Dark':
        setThemeColors({ heading: '#f8fafc', body: '#cbd5e1', button: '#ffffff', nav: '#f8fafc', footer: '#94a3b8', link: '#60a5fa', hover: '#93c5fd' });
        break;
      case 'Elegant Gold':
        setThemeColors({ heading: '#b45309', body: '#78350f', button: '#ffffff', nav: '#92400e', footer: '#d97706', link: '#d97706', hover: '#f59e0b' });
        break;
      default:
        break;
    }
  };

  const fetchHeroSlides = async () => {
    const { data } = await supabase.from('hero_slides').select('*').order('created_at', { ascending: false });
    if (data) setHeroSlides(data);
  };

  const fetchFaculty = async () => {
    const { data } = await supabase.from('faculty').select('*').order('name');
    if (data) setFaculty(data);
  };

  const fetchGallery = async () => {
    const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (data) setGallery(data);
  };

  const fetchGallerySectionText = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'gallery_section_text').single();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (parsed.title) setGallerySectionTitle(parsed.title);
      if (parsed.subtitle) setGallerySectionSubtitle(parsed.subtitle);
    }
  };

  const saveGallerySectionText = async () => {
    if (isReadOnly) return alert('Cannot modify data in read-only mode.');
    const value = JSON.stringify({ title: gallerySectionTitle, subtitle: gallerySectionSubtitle });
    
    // Check if exists
    const { data: existing } = await supabase.from('site_settings').select('id').eq('key', 'gallery_section_text').single();
    if (existing) {
      await supabase.from('site_settings').update({ value }).eq('key', 'gallery_section_text');
    } else {
      await supabase.from('site_settings').insert([{ key: 'gallery_section_text', value }]);
    }
    alert('Gallery section title and subtitle saved!');
  };

  const uploadFileToSupabase = async (file, folder) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('public-assets')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUploadHero = async (e) => {
    e.preventDefault();
    if (!heroFiles || heroFiles.length === 0) return alert('Please select at least one file');

    setUploadingHero(true);
    try {
      for (let i = 0; i < heroFiles.length; i++) {
        const file = heroFiles[i];
        const imageUrl = await uploadFileToSupabase(file, 'hero');
        const { error: insertError } = await supabase.from('hero_slides').insert([{ media_url: imageUrl }]);
        if (insertError) throw insertError;
      }
      setHeroFiles([]);
      if (heroFileRef.current) heroFileRef.current.value = '';
      fetchHeroSlides();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingHero(false);
    }
  };

  const handleDeleteHeroSlide = async (id) => {
    if (!window.confirm("Delete this slide?")) return;
    await supabase.from('hero_slides').delete().match({ id });
    fetchHeroSlides();
  };

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (isReadOnly) {
      alert("This action is disabled. The portal is in Read-Only Mode because the school subscription has expired.");
      return;
    }
    if (faculty.length >= allowedTeachers) {
      alert(`Teacher/Faculty limit reached (${allowedTeachers} allowed). Please upgrade your subscription plan.`);
      return;
    }
    if (!newFaculty.name || !newFaculty.designation) return alert('Name and Designation are required');
    
    setUploadingFaculty(true);
    try {
      let imageUrl = null;
      if (facultyFile) {
        imageUrl = await uploadFileToSupabase(facultyFile, 'faculty');
      }

      const { error } = await supabase.from('faculty').insert([{
        ...newFaculty,
        image_url: imageUrl
      }]);
      
      if (error) throw error;

      setNewFaculty({ name: '', designation: '', department: '', bio: '' });
      setFacultyFile(null);
      if (facultyFileRef.current) facultyFileRef.current.value = '';
      fetchFaculty();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingFaculty(false);
    }
  };

  const handleDeleteFaculty = async (id) => {
    if (!window.confirm("Delete this faculty profile?")) return;
    await supabase.from('faculty').delete().match({ id });
    fetchFaculty();
  };

  const handleAddPhotos = async (e) => {
    e.preventDefault();
    if (!galleryCategory) return alert('Category is required');
    if (!galleryFiles || galleryFiles.length === 0) return alert('Please select at least one image');

    setUploadingGallery(true);
    setGalleryUploadProgress({ current: 0, total: galleryFiles.length });

    try {
      for (let i = 0; i < galleryFiles.length; i++) {
        const file = galleryFiles[i];
        const imageUrl = await uploadFileToSupabase(file, 'gallery');
        
        // Use filename as title, minus extension
        const title = file.name.split('.').slice(0, -1).join('.');

        const { error: insertError } = await supabase.from('gallery').insert([{
          title: title,
          category: galleryCategory,
          year: galleryYear,
          image_url: imageUrl
        }]);
        if (insertError) throw insertError;

        setGalleryUploadProgress({ current: i + 1, total: galleryFiles.length });
      }

      setGalleryCategory('');
      setGalleryFiles([]);
      if (galleryFileRef.current) galleryFileRef.current.value = '';
      fetchGallery();
    } catch (err) {
      alert("Bulk upload failed: " + err.message);
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleDeletePhoto = async (id) => {
    if (!window.confirm("Delete this photo?")) return;
    await supabase.from('gallery').delete().match({ id });
    fetchGallery();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '2rem' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', color: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <label style={{ fontWeight: 'bold', color: '#475569' }}>Select CMS Section:</label>
        <select 
          className="input-field" 
          value={cmsSection} 
          onChange={e => setCmsSection(e.target.value)}
          style={{ minWidth: '250px', background: 'white', flex: 1, maxWidth: '400px' }}
        >
          <option value="general">General (Branding, Theme, Footer, Menu)</option>
          <option value="homepage">Home Page (Hero, Popup, Academic Excellence, Divisions)</option>
          <option value="redesign">Homepage V2 Sections (New Design)</option>
          <option value="school_data">School Data (Faculty, Gallery, Disclosures, Facilities)</option>
          <option value="news">News & Announcements</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

      {cmsSection === 'homepage' && (
        <>
      {/* Homepage Campaign Pop-Up Controller */}
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Megaphone size={20} color="#3b82f6" /> 🎓 Notice Campaign Pop-Up Manager
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>Configure high-impact modal updates for emergency alerts, admissions campaigns, or live streams on the home screen.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <span>Show Campaign Popup:</span>
              <input 
                type="checkbox" 
                checked={popupConfig.enabled} 
                onChange={e => setPopupConfig({ ...popupConfig, enabled: e.target.checked })}
                style={{ width: '1.2rem', height: '1.2rem', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
            </label>
            <span className={`badge ${popupConfig.enabled ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {popupConfig.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>

        <form onSubmit={savePopupConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Notice Category</label>
            <select 
              className="input-field w-full"
              value={popupConfig.category}
              onChange={e => setPopupConfig({ ...popupConfig, category: e.target.value })}
              style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }}
            >
              <option value="admission">🎓 Admissions / Enrollment Notice</option>
              <option value="emergency">🚨 High-Priority Emergency Notice (Bypasses Session Suppression!)</option>
              <option value="event">📹 Event livestream / Video Feature</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Headline Title</label>
            <input 
              type="text" 
              className="input-field w-full" 
              value={popupConfig.title} 
              onChange={e => setPopupConfig({ ...popupConfig, title: e.target.value })}
              placeholder="e.g. Admissions Open 2026-27"
              required
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Notice Description Body</label>
            <textarea 
              className="input-field w-full" 
              rows="3"
              value={popupConfig.description} 
              onChange={e => setPopupConfig({ ...popupConfig, description: e.target.value })}
              placeholder="Provide clean, descriptive context to display inside the popup..."
              required
              style={{ padding: '0.75rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Campaign YouTube URL (Optional, hides on Emergency alerts)</label>
            <input 
              type="text" 
              className="input-field w-full" 
              value={popupConfig.videoUrl} 
              onChange={e => setPopupConfig({ ...popupConfig, videoUrl: e.target.value })}
              placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>OR Upload Custom Video (.mp4, .webm)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="file" 
                accept="video/*" 
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setUploadingPopupVideo(true);
                  try {
                    const videoUrl = await uploadFileToSupabase(file, 'popups');
                    setPopupConfig({ ...popupConfig, videoUrl: videoUrl });
                    alert("Video uploaded and saved to Supabase storage successfully!");
                  } catch (err) {
                    alert("Video upload failed: " + err.message);
                  } finally {
                    setUploadingPopupVideo(false);
                  }
                }}
                className="input-field w-full"
                style={{ padding: '0.42rem', background: '#f8fafc', color: '#0f172a' }}
                disabled={uploadingPopupVideo}
              />
              {uploadingPopupVideo && <Loader2 className="animate-spin" size={20} color="#3b82f6" />}
            </div>
            {popupConfig.videoUrl && popupConfig.videoUrl.startsWith('http') && !popupConfig.videoUrl.includes('youtube') && !popupConfig.videoUrl.includes('youtu.be') && (
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600', display: 'block', marginTop: '0.25rem' }}>
                ✓ Custom video active (uploaded to storage)
              </span>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary CTA Button Label</label>
            <input 
              type="text" 
              className="input-field w-full" 
              value={popupConfig.buttonLabel} 
              onChange={e => setPopupConfig({ ...popupConfig, buttonLabel: e.target.value })}
              placeholder="e.g. Apply Online"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary CTA Target Destination URL</label>
            <input 
              type="text" 
              className="input-field w-full" 
              value={popupConfig.buttonUrl} 
              onChange={e => setPopupConfig({ ...popupConfig, buttonUrl: e.target.value })}
              placeholder="e.g. /admissions or https://external.com"
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={savingPopupConfig}>
              {savingPopupConfig ? <><Loader2 size={16} className="animate-spin inline mr-2" /> Saving Notice...</> : 'Save Campaign Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Our Divisions & Message Desks Manager */}
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Users size={20} color="#ea580c" /> 🏫 Our Divisions & Message Desks Manager
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>Add, edit, or remove home divisions and direct desk message cards (Director, Principal, Headmaster Desks).</p>
          </div>
          <div>
            <button 
              type="button" 
              onClick={() => setDivisions([...divisions, { id: Date.now().toString(), title: 'New Division / Desk', description: 'Description of this card...', icon: 'Users', color: '#3b82f6', bgColor: '#eff6ff', message: '' }])}
              className="btn-hero-primary" 
              style={{ background: '#ea580c', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} /> Add New Desk / Card
            </button>
          </div>
        </div>

        <form onSubmit={saveDivisions} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section Titles Editing Block */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', background: '#f1f5f9', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Academic Divisions Section Title</label>
              <input 
                type="text" 
                className="input-field w-full"
                value={divisionsTitle}
                onChange={e => setDivisionsTitle(e.target.value)}
                placeholder="e.g. OUR DIVISIONS"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Leadership Pillars Section Title</label>
              <input 
                type="text" 
                className="input-field w-full"
                value={pillarsTitle}
                onChange={e => setPillarsTitle(e.target.value)}
                placeholder="e.g. OUR PILLARS"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {divisions.map((card, index) => (
              <div key={card.id} style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.75rem', background: '#f8fafc', color: '#0f172a', position: 'relative' }}>
                <button 
                  type="button"
                  onClick={() => {
                    if(window.confirm("Remove this card?")) {
                      setDivisions(divisions.filter(d => d.id !== card.id));
                    }
                  }}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                >
                  <Trash2 size={16} />
                </button>

                <h4 style={{ fontWeight: '800', marginBottom: '1rem', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Card {index + 1}</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Card Title</label>
                    <input 
                      type="text" 
                      className="input-field w-full" 
                      value={card.title} 
                      onChange={e => {
                        const next = [...divisions];
                        next[index].title = e.target.value;
                        setDivisions(next);
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Card Short Description</label>
                    <input 
                      type="text" 
                      className="input-field w-full" 
                      value={card.description} 
                      onChange={e => {
                        const next = [...divisions];
                        next[index].description = e.target.value;
                        setDivisions(next);
                      }}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Icon</label>
                      <select 
                        className="input-field w-full" 
                        value={card.icon} 
                        onChange={e => {
                          const next = [...divisions];
                          next[index].icon = e.target.value;
                          setDivisions(next);
                        }}
                        style={{ padding: '0.4rem' }}
                      >
                        <option value="Users">Users</option>
                        <option value="BookOpen">BookOpen</option>
                        <option value="Award">Award</option>
                        <option value="Shield">Shield</option>
                        <option value="Megaphone">Megaphone</option>
                        <option value="Bell">Bell</option>
                        <option value="Trophy">Trophy</option>
                        <option value="FileText">FileText</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>Colors (Text / Bg)</label>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input 
                          type="color" 
                          value={card.color || '#3b82f6'} 
                          onChange={e => {
                            const next = [...divisions];
                            next[index].color = e.target.value;
                            setDivisions(next);
                          }}
                          style={{ width: '100%', height: '34px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
                        />
                        <input 
                          type="color" 
                          value={card.bgColor || '#eff6ff'} 
                          onChange={e => {
                            const next = [...divisions];
                            next[index].bgColor = e.target.value;
                            setDivisions(next);
                          }}
                          style={{ width: '100%', height: '34px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Direct Desk Message (Optional)</label>
                    <textarea 
                      className="input-field w-full" 
                      rows="3"
                      value={card.message || ''} 
                      onChange={e => {
                        const next = [...divisions];
                        next[index].message = e.target.value;
                        setDivisions(next);
                      }}
                      placeholder="Write the message from Director, Principal, or Headmaster here. Leaves empty to disable the 'Read Desk Message' button."
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={card.isPillar || false} 
                        onChange={e => {
                          const next = [...divisions];
                          next[index].isPillar = e.target.checked;
                          setDivisions(next);
                        }}
                        style={{ width: '1.05rem', height: '1.05rem', accentColor: '#ea580c', cursor: 'pointer' }}
                      />
                      <span>Is Leadership Desk / Pillar Card?</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#ea580c', color: 'white', border: 'none', padding: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={savingDivisions}>
              {savingDivisions ? <><Loader2 size={16} className="animate-spin inline mr-2" /> Saving Divisions...</> : 'Save Divisions & Message Desks'}
            </button>
          </div>
        </form>
      </div>
      </>)}

      {/* Campus Facilities Manager */}
      {cmsSection === 'school_data' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <ImageIcon size={20} color="#166534" /> 🏫 Campus Facilities Manager
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>Manage the list of campus facilities cards, customize titles, upload high-quality pictures, add new facilities, or remove them.</p>
          </div>
          <div>
            <button 
              type="button" 
              onClick={handleAddFacility}
              className="btn-hero-primary" 
              style={{ background: '#166534', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} /> Add New Facility
            </button>
          </div>
        </div>

        <form onSubmit={saveFacilities} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {facilities.map((fac, index) => (
              <div key={fac.id} style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.75rem', background: '#f8fafc', color: '#0f172a', position: 'relative' }}>
                <button 
                  type="button"
                  onClick={() => handleDeleteFacility(fac.id)}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                >
                  <Trash2 size={16} />
                </button>

                <h4 style={{ fontWeight: '800', marginBottom: '1rem', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facility {index + 1}</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2' }}>Facility Title</label>
                    <input 
                      type="text" 
                      className="input-field w-full" 
                      value={fac.title} 
                      onChange={e => {
                        const next = [...facilities];
                        next[index].title = e.target.value;
                        setFacilities(next);
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Current Image Preview</label>
                    {fac.imageUrl ? (
                      <img src={fac.imageUrl} alt={fac.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1' }} />
                    ) : (
                      <div style={{ width: '100%', height: '140px', background: '#e2e8f0', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>No image loaded</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Upload New Image</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => setFacilityFiles({...facilityFiles, [fac.id]: e.target.files[0]})}
                      className="input-field w-full"
                      style={{ padding: '0.42rem', background: '#f8fafc', color: '#0f172a' }}
                    />
                    {facilityFiles[fac.id] && (
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '600', display: 'block', marginTop: '0.25rem' }}>
                        ✓ New image queued for upload
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#166534', color: 'white', border: 'none', padding: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={savingFacilities}>
              {savingFacilities ? <><Loader2 size={16} className="animate-spin inline mr-2" /> Saving Facilities...</> : 'Save Campus Facilities'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Academic Excellence Manager */}
      {cmsSection === 'homepage' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layout size={20} color="#166534" /> Academic Excellence Manager
        </h3>
        <form onSubmit={saveAcademicExcellence} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {academicExcellence.map((item, index) => (
            <div key={item.id} style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.5rem', background: '#f8fafc', color: '#0f172a' }}>
              <h4 style={{ fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Card {index + 1}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Title</label>
                  <input type="text" className="input-field w-full" value={item.title} onChange={e => {
                    const newAE = [...academicExcellence];
                    newAE[index].title = e.target.value;
                    setAcademicExcellence(newAE);
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Current Image</label>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100px', background: item.bgColor, borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Default Icon</span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Upload New Image</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={index === 0 ? aeRef1 : index === 1 ? aeRef2 : aeRef3}
                    onChange={e => setAeFiles({...aeFiles, [item.id]: e.target.files[0]})} 
                    className="input-field w-full" 
                  />
                </div>
              </div>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#166534', color: 'white', border: 'none', padding: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={savingAcademicExcellence}>
              {savingAcademicExcellence ? <><Loader2 size={16} className="animate-spin inline mr-2" /> Saving...</> : 'Save Academic Excellence'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Mandatory Disclosures Manager */}
      {cmsSection === 'school_data' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} color="#0284c7" /> Mandatory Disclosures Manager
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Add New Form */}
          <form onSubmit={saveNewDisclosure} style={{ background: '#f8fafc', color: '#0f172a', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Add New Document</h4>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Title</label>
              <input type="text" required className="input-field w-full" value={newDisclosure.title} onChange={e => setNewDisclosure({...newDisclosure, title: e.target.value})} placeholder="e.g. Fire Safety Certificate 2026" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Category</label>
              <select className="input-field w-full" value={newDisclosure.category} onChange={e => setNewDisclosure({...newDisclosure, category: e.target.value})}>
                {disclosureCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Upload PDF/Document</label>
              <input type="file" required ref={disclosureFileRef} className="input-field w-full" accept=".pdf,.doc,.docx" />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Display Order</label>
                <input type="number" required className="input-field w-full" value={newDisclosure.order} onChange={e => setNewDisclosure({...newDisclosure, order: e.target.value})} min="1" />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', paddingBottom: '0.5rem' }}>
                  <input type="checkbox" checked={newDisclosure.isActive} onChange={e => setNewDisclosure({...newDisclosure, isActive: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem' }} />
                  <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Active</span>
                </label>
              </div>
            </div>
            <button type="submit" className="btn-hero-primary" style={{ background: '#0284c7', color: 'white', border: 'none', padding: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={savingDisclosures}>
              {savingDisclosures ? <><Loader2 size={16} className="animate-spin inline mr-2" /> Uploading...</> : 'Add Document'}
            </button>
          </form>

          {/* Current Documents List */}
          <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Current Documents ({mandatoryDisclosures.length})</h4>
            {mandatoryDisclosures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', border: '2px dashed #cbd5e1', borderRadius: '0.5rem' }}>No documents added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[...mandatoryDisclosures].sort((a,b) => a.order - b.order).map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ background: '#f0f9ff', color: '#0284c7', padding: '0.5rem', borderRadius: '0.5rem' }}><FileText size={20} /></div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{doc.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>{doc.category}</span>
                          <span style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>Order: {doc.order}</span>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 'bold' }}>View</a>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button onClick={() => toggleDisclosureActive(doc.id)} style={{ padding: '0.4rem 0.8rem', borderRadius: '0.25rem', border: 'none', fontSize: '0.75rem', fontWeight: 'bold', background: doc.isActive ? '#dcfce7' : '#f1f5f9', color: doc.isActive ? '#166534' : '#64748b', cursor: 'pointer', minWidth: '70px' }}>
                        {doc.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => deleteDisclosure(doc.id)} style={{ padding: '0.4rem', borderRadius: '0.25rem', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Homepage Hero Manager */}
      {cmsSection === 'homepage' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Monitor size={20} color="#f59e0b" /> Homepage Hero Slider Manager
        </h3>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <form onSubmit={handleUploadHero} style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ border: '2px dashed #f59e0b', padding: '1.5rem', borderRadius: '0.5rem', background: 'rgba(245, 158, 11, 0.05)', textAlign: 'center' }}>
              <UploadCloud size={32} color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
              <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Upload Images or Videos</label>
              <input 
                type="file" 
                accept="image/*,video/*"
                multiple
                ref={heroFileRef}
                onChange={e => setHeroFiles(e.target.files)}
                style={{ width: '100%', fontSize: '0.9rem' }}
                required
              />
            </div>
            <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#f59e0b', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={uploadingHero}>
              {uploadingHero ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Plus size={16} /> Add to Slider</>}
            </button>
          </form>
          
          <div style={{ flex: 2, minWidth: '300px' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Current Slides ({heroSlides.length})</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {heroSlides.length > 0 ? heroSlides.map(slide => (
                <div key={slide.id} style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '0.5rem', overflow: 'hidden', background: 'black', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {slide.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video src={slide.media_url} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={slide.media_url} alt="Slide" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <button 
                    onClick={() => handleDeleteHeroSlide(slide.id)}
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: '#ef4444', color: 'white', border: 'none', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )) : (
                 <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', background: '#f8fafc', color: '#94a3b8', borderRadius: '0.5rem' }}>
                   No custom slides added. Default graphic is shown.
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Hero Content & Style Manager */}
      {cmsSection === 'homepage' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Monitor size={20} color="#3b82f6" /> Hero Content & Style Manager
        </h3>
        <form onSubmit={saveHeroStyling} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* Texts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Text Content</h4>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Top Badge Text</label>
              <input type="text" className="input-field" placeholder="e.g. A TRADITION OF EXCELLENCE" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.badge !== undefined ? heroStyle.badge : 'A TRADITION OF EXCELLENCE'} onChange={e => setHeroStyle({...heroStyle, badge: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Subtitle</label>
              <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.subtitle} onChange={e => setHeroStyle({...heroStyle, subtitle: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Main Title</label>
              <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.title} onChange={e => setHeroStyle({...heroStyle, title: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Description</label>
              <textarea rows="2" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.description} onChange={e => setHeroStyle({...heroStyle, description: e.target.value})}></textarea>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Buttons</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary Text</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.btnPrimaryText} onChange={e => setHeroStyle({...heroStyle, btnPrimaryText: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary Link</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.btnPrimaryLink} onChange={e => setHeroStyle({...heroStyle, btnPrimaryLink: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Secondary Text</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.btnSecondaryText} onChange={e => setHeroStyle({...heroStyle, btnSecondaryText: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Secondary Link</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.btnSecondaryLink} onChange={e => setHeroStyle({...heroStyle, btnSecondaryLink: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Hero Statistics (The 4 numbers at the bottom)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Stat {index + 1} Value (e.g. 30+)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ width: '100%', background: '#fff', color: '#0f172a', marginBottom: '0.5rem' }} 
                    value={(heroStyle.stats && heroStyle.stats[index]) ? heroStyle.stats[index].value : ''} 
                    onChange={e => {
                      const newStats = [...(heroStyle.stats || [
                        { label: 'Years of Legacy', value: '30+' },
                        { label: 'Pass Rate', value: '100%' },
                        { label: 'Students', value: '2500+' },
                        { label: 'Faculty Members', value: '150+' }
                      ])];
                      newStats[index] = { ...newStats[index], value: e.target.value };
                      setHeroStyle({...heroStyle, stats: newStats});
                    }} 
                  />
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Stat {index + 1} Label (e.g. Years of Legacy)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ width: '100%', background: '#fff', color: '#0f172a' }} 
                    value={(heroStyle.stats && heroStyle.stats[index]) ? heroStyle.stats[index].label : ''} 
                    onChange={e => {
                      const newStats = [...(heroStyle.stats || [
                        { label: 'Years of Legacy', value: '30+' },
                        { label: 'Pass Rate', value: '100%' },
                        { label: 'Students', value: '2500+' },
                        { label: 'Faculty Members', value: '150+' }
                      ])];
                      newStats[index] = { ...newStats[index], label: e.target.value };
                      setHeroStyle({...heroStyle, stats: newStats});
                    }} 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Styling */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Colors & Shapes</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Title Color</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.titleColor} onChange={e => setHeroStyle({...heroStyle, titleColor: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Subtitle Color</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.subtitleColor} onChange={e => setHeroStyle({...heroStyle, subtitleColor: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary Btn Color</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.btnPrimaryColor} onChange={e => setHeroStyle({...heroStyle, btnPrimaryColor: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Secondary Btn Color</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.btnSecondaryColor} onChange={e => setHeroStyle({...heroStyle, btnSecondaryColor: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Overlay Color</label>
                <input type="color" style={{ width: '100%', height: '40px', cursor: 'pointer' }} value={heroStyle.overlayColor || '#0f172a'} onChange={e => setHeroStyle({...heroStyle, overlayColor: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Overlay Opacity ({heroStyle.overlayOpacity ?? 0.8})</label>
                <input type="range" min="0" max="1" step="0.1" style={{ width: '100%', cursor: 'pointer' }} value={heroStyle.overlayOpacity ?? 0.8} onChange={e => setHeroStyle({...heroStyle, overlayOpacity: parseFloat(e.target.value)})} />
              </div>
            </div>


            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Button Shape</label>
              <select className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a' }} value={heroStyle.btnShape} onChange={e => setHeroStyle({...heroStyle, btnShape: e.target.value})}>
                <option value="0px">Square (0px)</option>
                <option value="8px">Rounded (8px)</option>
                <option value="2rem">Pill (Fully Rounded)</option>
              </select>
            </div>
            
            <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem', width: '100%', marginTop: 'auto' }} disabled={savingHeroStyle}>
              {savingHeroStyle ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Hero Styling'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Site Branding Manager */}
      {cmsSection === 'general' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon size={20} color="#16a34a" /> Site Branding Manager
        </h3>
        <form onSubmit={saveSiteBranding} style={{ display: 'grid', gap: '1rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>School Name</label>
              <input 
                type="text" 
                maxLength="80"
                value={siteBranding.siteName || ''} 
                onChange={(e) => setSiteBranding({...siteBranding, siteName: e.target.value})}
                className="input-field" 
                required 
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>School Motto (Optional)</label>
              <input 
                type="text" 
                maxLength="80"
                value={siteBranding.siteMotto || ''} 
                onChange={(e) => setSiteBranding({...siteBranding, siteMotto: e.target.value})}
                className="input-field" 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Current Logo</label>
              <div style={{ background: '#e2e8f0', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src={siteBranding.logoUrl || '/logo.png'} alt="Logo" style={{ height: '3rem', width: '3rem', objectFit: 'contain', background: 'white', borderRadius: '0.25rem', padding: '0.25rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Upload New Logo</label>
              <input 
                type="file" 
                accept="image/*" 
                ref={logoFileRef}
                onChange={(e) => setLogoFile(e.target.files[0])}
                className="input-field" 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Current Favicon</label>
              <div style={{ background: '#e2e8f0', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src={siteBranding.faviconUrl || '/vite.svg'} alt="Favicon" style={{ height: '3rem', width: '3rem', objectFit: 'contain', background: 'white', borderRadius: '0.25rem', padding: '0.25rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Upload New Favicon (.ico/png)</label>
              <input 
                type="file" 
                accept="image/*,.ico" 
                ref={faviconFileRef}
                onChange={(e) => setFaviconFile(e.target.files[0])}
                className="input-field" 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#16a34a', color: 'white', border: 'none', padding: '0.75rem', flex: 1 }} disabled={savingSiteBranding}>
              {savingSiteBranding ? 'Saving...' : 'Save Site Branding'}
            </button>
            <button type="button" onClick={resetBranding} className="btn-hero-outline" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.75rem' }}>
              Reset Default
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Theme Colors Manager */}
      {cmsSection === 'general' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Palette size={20} color="#eab308" /> Theme Colors
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => applyPreset('School Green')} className="btn-sm" style={{ background: '#166534', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer' }}>School Green</button>
          <button onClick={() => applyPreset('Classic White')} className="btn-sm" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer' }}>Classic White</button>
          <button onClick={() => applyPreset('Modern Dark')} className="btn-sm" style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer' }}>Modern Dark</button>
          <button onClick={() => applyPreset('Elegant Gold')} className="btn-sm" style={{ background: '#b45309', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer' }}>Elegant Gold</button>
        </div>
        
        <form onSubmit={saveThemeColors} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Heading Text Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.heading || '#0f172a'} onChange={(e) => setThemeColors({...themeColors, heading: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.heading || '#0f172a'} readOnly style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Body Text Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.body || '#64748b'} onChange={(e) => setThemeColors({...themeColors, body: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.body || '#64748b'} readOnly style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Button Text Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.button || '#ffffff'} onChange={(e) => setThemeColors({...themeColors, button: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.button || '#ffffff'} readOnly style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Navigation Menu Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.nav || '#1f2937'} onChange={(e) => setThemeColors({...themeColors, nav: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.nav || '#1f2937'} readOnly style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Footer Text Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.footer || '#9ca3af'} onChange={(e) => setThemeColors({...themeColors, footer: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.footer || '#9ca3af'} readOnly style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Link Text Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.link || '#2563eb'} onChange={(e) => setThemeColors({...themeColors, link: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.link || '#2563eb'} readOnly style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Hover Text Color</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="color" value={themeColors.hover || '#1d4ed8'} onChange={(e) => setThemeColors({...themeColors, hover: e.target.value})} style={{ height: '2.5rem', width: '3rem', padding: '0', cursor: 'pointer' }} />
              <input type="text" className="input-field" value={themeColors.hover || '#1d4ed8'} readOnly style={{ flex: 1 }} />
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Live Preview</h4>
            <div style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.5rem', background: '#fff' }}>
              <h2 style={{ color: themeColors.heading, margin: 0, padding: 0 }}>This is a Heading Preview</h2>
              <p style={{ color: themeColors.body, marginTop: '0.5rem' }}>This is how your standard body text will appear across the website.</p>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button type="button" style={{ background: '#3b82f6', color: themeColors.button, padding: '0.5rem 1rem', border: 'none', borderRadius: '0.25rem' }}>Sample Button</button>
                <a href="#" onClick={e=>e.preventDefault()} style={{ color: themeColors.link, textDecoration: 'none' }}>Sample Link</a>
                <span style={{ color: themeColors.nav, fontWeight: '500' }}>Nav Item Preview</span>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#eab308', color: 'black', border: 'none', padding: '0.75rem', width: '100%' }} disabled={savingThemeColors}>
              {savingThemeColors ? 'Saving...' : 'Save Theme Colors'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Footer Settings Manager */}
      {cmsSection === 'general' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layout size={20} color="#3b82f6" /> Footer Settings Manager
        </h3>
        
        <form onSubmit={saveFooterSettings} style={{ display: 'grid', gap: '2rem' }}>
          
          {/* Contact Details */}
          <div style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.5rem', background: '#fff' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Contact Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Phone</label>
                <input type="text" className="input-field" value={footerSettings.contact.phone} onChange={e => setFooterSettings({...footerSettings, contact: {...footerSettings.contact, phone: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Email</label>
                <input type="email" className="input-field" value={footerSettings.contact.email} onChange={e => setFooterSettings({...footerSettings, contact: {...footerSettings.contact, email: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Office Hours</label>
                <input type="text" className="input-field" value={footerSettings.contact.officeHours} onChange={e => setFooterSettings({...footerSettings, contact: {...footerSettings.contact, officeHours: e.target.value}})} />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.5rem', background: '#fff' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Social Media URLs (Leave blank to hide)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Facebook</label>
                <input type="url" className="input-field" value={footerSettings.socialMedia.facebook} onChange={e => setFooterSettings({...footerSettings, socialMedia: {...footerSettings.socialMedia, facebook: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Instagram</label>
                <input type="url" className="input-field" value={footerSettings.socialMedia.instagram} onChange={e => setFooterSettings({...footerSettings, socialMedia: {...footerSettings.socialMedia, instagram: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>YouTube</label>
                <input type="url" className="input-field" value={footerSettings.socialMedia.youtube} onChange={e => setFooterSettings({...footerSettings, socialMedia: {...footerSettings.socialMedia, youtube: e.target.value}})} />
              </div>
            </div>
          </div>

          {/* Find Us */}
          <div style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.5rem', background: '#fff' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Find Us & Location</h4>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>School Address</label>
                <textarea className="input-field" rows="3" value={footerSettings.findUs.address} onChange={e => setFooterSettings({...footerSettings, findUs: {...footerSettings.findUs, address: e.target.value}})}></textarea>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Key Stats (separated by |)</label>
                <input type="text" className="input-field" placeholder="1200+ Students | 75+ Teachers | 98% Results | 25 Years of Excellence" value={footerSettings.findUs.stats || ''} onChange={e => setFooterSettings({...footerSettings, findUs: {...footerSettings.findUs, stats: e.target.value}})} />
              </div>
            </div>
          </div>
          
          {/* Legal Text */}
          <div style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '0.5rem', background: '#fff' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Affiliation & Legal</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Affiliation Text</label>
                <input type="text" className="input-field" value={footerSettings.legal.affiliation} onChange={e => setFooterSettings({...footerSettings, legal: {...footerSettings.legal, affiliation: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Copyright Notice</label>
                <input type="text" className="input-field" value={footerSettings.legal.copyright} onChange={e => setFooterSettings({...footerSettings, legal: {...footerSettings.legal, copyright: e.target.value}})} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={savingFooterSettings}>
              {savingFooterSettings ? 'Saving...' : 'Save Footer Settings'}
            </button>
          </div>
        </form>
      </div>
      )}
      {/* Menu Builder */}
      {cmsSection === 'general' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <List size={20} color="#f97316" /> Navigation Menu Builder
          </h3>
          <button onClick={addMenuItem} type="button" className="btn-hero-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f97316', color: 'white', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <Plus size={16} /> Add Top-Level Menu
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {mainMenu.map((item, index) => (
            <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', overflow: 'hidden' }}>
              {/* Parent Item */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', color: '#0f172a', borderBottom: item.children?.length > 0 ? '1px solid #e2e8f0' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button type="button" onClick={() => moveMenuItem(index, 'up')} disabled={index === 0} style={{ padding: 0, border: 'none', background: 'transparent', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#cbd5e1' : '#64748b' }}><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => moveMenuItem(index, 'down')} disabled={index === mainMenu.length - 1} style={{ padding: 0, border: 'none', background: 'transparent', cursor: index === mainMenu.length - 1 ? 'not-allowed' : 'pointer', color: index === mainMenu.length - 1 ? '#cbd5e1' : '#64748b' }}><ArrowDown size={14} /></button>
                  </div>
                  {editingMenuItem?.item.id === item.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="text" className="input-field" value={editingMenuItem.item.label} onChange={(e) => setEditingMenuItem({...editingMenuItem, item: {...editingMenuItem.item, label: e.target.value}})} style={{ width: '150px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} />
                      <input type="text" className="input-field" value={editingMenuItem.item.url} onChange={(e) => setEditingMenuItem({...editingMenuItem, item: {...editingMenuItem.item, url: e.target.value}})} style={{ width: '150px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} />
                      <select className="input-field" value={editingMenuItem.item.type} onChange={(e) => setEditingMenuItem({...editingMenuItem, item: {...editingMenuItem.item, type: e.target.value}})} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                        <option value="simple">Simple Link</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="mega">Mega Menu</option>
                      </select>
                      <button type="button" onClick={() => saveEditedItem(editingMenuItem.item, editingMenuItem.parentId, editingMenuItem.index)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}><CheckCircle2 size={16} /></button>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {item.label}
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '1rem', background: item.type === 'mega' ? '#8b5cf6' : item.type === 'dropdown' ? '#3b82f6' : '#e2e8f0', color: item.type === 'simple' ? '#64748b' : 'white' }}>{item.type}</span>
                        {!item.isActive && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '1rem', background: '#ef4444', color: 'white' }}>Hidden</span>}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{item.url}</p>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button type="button" onClick={() => addSubItem(item.id)} title="Add Submenu Item" style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#10b981' }}><Plus size={16} /></button>
                  <button type="button" onClick={() => setEditingMenuItem({ item: {...item}, parentId: null, index })} title="Edit" style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button type="button" onClick={() => deleteMenuItem(item.id)} title="Delete" style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                </div>
              </div>

              {/* Child Items */}
              {item.children && item.children.length > 0 && (
                <div style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#fff' }}>
                  {item.children.map((child, childIndex) => (
                    <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderLeft: '2px solid #e2e8f0', marginLeft: '2rem', background: '#f8fafc', color: '#0f172a', borderRadius: '0 0.5rem 0.5rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <button type="button" onClick={() => moveMenuItem(childIndex, 'up', item.id)} disabled={childIndex === 0} style={{ padding: 0, border: 'none', background: 'transparent', cursor: childIndex === 0 ? 'not-allowed' : 'pointer', color: childIndex === 0 ? '#cbd5e1' : '#64748b' }}><ArrowUp size={12} /></button>
                          <button type="button" onClick={() => moveMenuItem(childIndex, 'down', item.id)} disabled={childIndex === item.children.length - 1} style={{ padding: 0, border: 'none', background: 'transparent', cursor: childIndex === item.children.length - 1 ? 'not-allowed' : 'pointer', color: childIndex === item.children.length - 1 ? '#cbd5e1' : '#64748b' }}><ArrowDown size={12} /></button>
                        </div>
                        {editingMenuItem?.item.id === child.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input type="text" className="input-field" value={editingMenuItem.item.label} onChange={(e) => setEditingMenuItem({...editingMenuItem, item: {...editingMenuItem.item, label: e.target.value}})} style={{ width: '120px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} />
                            <input type="text" className="input-field" value={editingMenuItem.item.url} onChange={(e) => setEditingMenuItem({...editingMenuItem, item: {...editingMenuItem.item, url: e.target.value}})} style={{ width: '120px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} />
                            <button type="button" onClick={() => saveEditedItem(editingMenuItem.item, editingMenuItem.parentId, editingMenuItem.index)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '0.25rem', padding: '0.25rem', cursor: 'pointer' }}><CheckCircle2 size={14} /></button>
                          </div>
                        ) : (
                          <div>
                            <h5 style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{child.label}</h5>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>{child.url}</p>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button type="button" onClick={() => setEditingMenuItem({ item: {...child}, parentId: item.id, index: childIndex })} title="Edit" style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><Edit2 size={14} /></button>
                        <button type="button" onClick={() => deleteMenuItem(child.id, item.id)} title="Delete" style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={saveMainMenu} type="button" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#f97316', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={savingMenu}>
          {savingMenu ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Menu Structure'}
        </button>
      </div>
      )}

      {/* Faculty Manager */}
      {cmsSection === 'school_data' && (
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="#8b5cf6" /> Faculty Manager
        </h3>
        <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <input type="text" placeholder="Name" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }} value={newFaculty.name} onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="text" placeholder="Designation" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }} value={newFaculty.designation} onChange={e => setNewFaculty({...newFaculty, designation: e.target.value})} required />
            <input type="text" placeholder="Department" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }} value={newFaculty.department} onChange={e => setNewFaculty({...newFaculty, department: e.target.value})} />
          </div>
          
          <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '0.5rem', background: '#f8fafc', color: '#0f172a' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Profile Photo (Optional)</label>
            <input 
              type="file" 
              accept="image/*"
              ref={facultyFileRef}
              onChange={e => setFacultyFile(e.target.files[0])}
              style={{ width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <textarea placeholder="Short Bio" rows="2" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }} value={newFaculty.bio} onChange={e => setNewFaculty({...newFaculty, bio: e.target.value})}></textarea>
          
          <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={uploadingFaculty}>
            {uploadingFaculty ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Plus size={16} /> Add Faculty</>}
          </button>
        </form>

        <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faculty.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', color: '#0f172a', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {f.image_url ? <img src={f.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0' }}></div>}
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '0.875rem', margin: 0 }}>{f.name}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{f.designation}</p>
                </div>
              </div>
              <button onClick={() => handleDeleteFaculty(f.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Gallery Manager */}
      {cmsSection === 'school_data' && (
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon size={20} color="#10b981" /> Bulk Photo Gallery Manager
        </h3>

        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#0f172a' }}>Gallery Section Title & Subtitle</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input type="text" placeholder="Title (e.g. Life at Gyanoday Niketan)" className="input-field" style={{ width: '100%', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} value={gallerySectionTitle} onChange={e => setGallerySectionTitle(e.target.value)} />
            <input type="text" placeholder="Subtitle (e.g. Glimpses of our vibrant campus life)" className="input-field" style={{ width: '100%', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} value={gallerySectionSubtitle} onChange={e => setGallerySectionSubtitle(e.target.value)} />
          </div>
          <button onClick={saveGallerySectionText} className="btn-hero-primary" style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem' }}>
            Save Title & Subtitle
          </button>
        </div>

        <form onSubmit={handleAddPhotos} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="text" placeholder="Category (e.g. Sports, Academics)" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }} value={galleryCategory} onChange={e => setGalleryCategory(e.target.value)} required />
            <input type="text" placeholder="Year (e.g. 2026)" className="input-field" style={{ width: '100%', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }} value={galleryYear} onChange={e => setGalleryYear(e.target.value)} required />
          </div>
          
          <div style={{ border: '2px dashed #10b981', padding: '1.5rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.05)', textAlign: 'center' }}>
            <UploadCloud size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
            <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Select Multiple Photos</label>
            <input 
              type="file" 
              accept="image/*,video/*"
              multiple
              ref={galleryFileRef}
              onChange={e => setGalleryFiles(Array.from(e.target.files))}
              style={{ width: '100%', fontSize: '0.9rem' }}
              required
            />
            {galleryFiles.length > 0 && <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#16a34a', fontWeight: 'bold' }}>{galleryFiles.length} files selected</p>}
          </div>

          <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={uploadingGallery}>
            {uploadingGallery ? <><Loader2 size={16} className="animate-spin" /> Uploading {galleryUploadProgress.current} of {galleryUploadProgress.total}...</> : <><Plus size={16} /> Bulk Upload Photos</>}
          </button>
        </form>

        <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {gallery.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', color: '#0f172a', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={p.image_url} alt="" style={{ width: '60px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '0.875rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{p.title}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{p.category}</p>
                </div>
              </div>
              <button onClick={() => handleDeletePhoto(p.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Manage News & Announcements */}
      {cmsSection === 'news' && (
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Megaphone size={20} color="#3b82f6" /> Manage News & Announcements
        </h3>
        <form onSubmit={handleAddNews} className="flex gap-2 mb-6">
          <input 
            type="text" 
            placeholder="Announcement text (e.g., ADMISSIONS OPEN...)" 
            className="input-field w-full" 
            style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', flex: 1 }}
            value={newNewsContent}
            onChange={e => setNewNewsContent(e.target.value)}
            required
          />
          <button type="submit" className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem' }}>Post</button>
        </form>

        <div style={{ maxHeight: '350px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead style={{ background: '#f8fafc', color: '#0f172a', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Announcement</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {news.map(n => (
                <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{n.content}</td>
                  <td style={{ padding: '1rem' }}>
                    <button 
                      onClick={() => handleToggleNews(n.id, n.is_active)}
                      className="btn-hero-outline"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '1rem', border: n.is_active ? '1px solid #10b981' : '1px solid #94a3b8', color: n.is_active ? '#10b981' : '#94a3b8' }}
                    >
                      {n.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button 
                      onClick={() => handleDeleteNews(n.id)} 
                      className="btn-hero-outline" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ef4444', border: '1px solid #fecaca' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {news.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No announcements found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      )}


      {/* ---------------- NEW REDESIGN SECTIONS ---------------- */}
      {cmsSection === 'redesign' && (
        <>
          {/* Welcome Section */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Welcome Section</h3>
            <form onSubmit={saveWelcomeSection} style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Badge: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={welcomeSection.badge} onChange={e => setWelcomeSection({...welcomeSection, badge: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={welcomeSection.title} onChange={e => setWelcomeSection({...welcomeSection, title: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={welcomeSection.description} onChange={e => setWelcomeSection({...welcomeSection, description: e.target.value})} rows="4" /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Link Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={welcomeSection.linkText} onChange={e => setWelcomeSection({...welcomeSection, linkText: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Link URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={welcomeSection.linkUrl} onChange={e => setWelcomeSection({...welcomeSection, linkUrl: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }} disabled={savingWelcome}>{savingWelcome ? 'Saving...' : 'Save Welcome Section'}</button>
            </form>
          </div>

          
          {/* Academic Journey Editor */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Academic Journey</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={divisionsEnabled} onChange={e => setDivisionsEnabled(e.target.checked)} />
                Enable Section
              </label>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Main Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={divisionsTitle} onChange={e => setDivisionsTitle(e.target.value)} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Subtitle: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={divisionsSubtitle} onChange={e => setDivisionsSubtitle(e.target.value)} /></label>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <h4 style={{ fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Cards</h4>
              {divisions.map((card, idx) => (
                <div key={idx} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => {
                        if(idx === 0) return;
                        const newDivs = [...divisions];
                        const temp = newDivs[idx-1];
                        newDivs[idx-1] = newDivs[idx];
                        newDivs[idx] = temp;
                        setDivisions(newDivs);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===0?'not-allowed':'pointer' }}>↑</button>
                      <button type="button" onClick={() => {
                        if(idx === divisions.length-1) return;
                        const newDivs = [...divisions];
                        const temp = newDivs[idx+1];
                        newDivs[idx+1] = newDivs[idx];
                        newDivs[idx] = temp;
                        setDivisions(newDivs);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===divisions.length-1?'not-allowed':'pointer' }}>↓</button>
                    </div>
                    <button type="button" onClick={() => {
                      if(confirm('Delete card?')) setDivisions(divisions.filter((_, i) => i !== idx));
                    }} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={card.title || ''} onChange={e => { const n = [...divisions]; n[idx].title = e.target.value; setDivisions(n); }} /></label>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Icon: 
                      <div style={{ marginTop: '0.25rem' }}>
                        <IconPicker value={card.icon} onChange={icon => { const n = [...divisions]; n[idx].icon = icon; setDivisions(n); }} />
                      </div>
                    </label>
                  </div>
                  
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} rows="2" value={card.description || ''} onChange={e => { const n = [...divisions]; n[idx].description = e.target.value; setDivisions(n); }} /></label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button Link: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={card.link || ''} onChange={e => { const n = [...divisions]; n[idx].link = e.target.value; setDivisions(n); }} /></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginTop: '1.5rem' }}>
                      <input type="checkbox" checked={card.isActive !== false} onChange={e => { const n = [...divisions]; n[idx].isActive = e.target.checked; setDivisions(n); }} />
                      Card Active
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setDivisions([...divisions, { title: 'New Card', description: '', icon: 'BookOpen', link: '/academics', isActive: true }])} className="btn-hero-outline" style={{ justifySelf: 'start', marginTop: '0.5rem' }}>+ Add Card</button>
            </div>
            <button className="btn-hero-primary" onClick={saveDivisions} style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem', width: '100%', marginTop: '2rem' }} disabled={savingDivisions}>{savingDivisions ? 'Saving...' : 'Save Academic Journey'}</button>
          </div>

          {/* Why Choose Us Editor */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Why Choose Us</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={whyChooseUsEnabled} onChange={e => setWhyChooseUsEnabled(e.target.checked)} />
                Enable Section
              </label>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Main Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={whyChooseUsTitle} onChange={e => setWhyChooseUsTitle(e.target.value)} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Subtitle: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={whyChooseUsSubtitle} onChange={e => setWhyChooseUsSubtitle(e.target.value)} /></label>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <h4 style={{ fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Features</h4>
              {whyChooseUs.map((card, idx) => (
                <div key={idx} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => {
                        if(idx === 0) return;
                        const newCards = [...whyChooseUs];
                        const temp = newCards[idx-1];
                        newCards[idx-1] = newCards[idx];
                        newCards[idx] = temp;
                        setWhyChooseUs(newCards);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===0?'not-allowed':'pointer' }}>↑</button>
                      <button type="button" onClick={() => {
                        if(idx === whyChooseUs.length-1) return;
                        const newCards = [...whyChooseUs];
                        const temp = newCards[idx+1];
                        newCards[idx+1] = newCards[idx];
                        newCards[idx] = temp;
                        setWhyChooseUs(newCards);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===whyChooseUs.length-1?'not-allowed':'pointer' }}>↓</button>
                    </div>
                    <button type="button" onClick={() => {
                      if(confirm('Delete feature?')) setWhyChooseUs(whyChooseUs.filter((_, i) => i !== idx));
                    }} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={card.title || ''} onChange={e => { const n = [...whyChooseUs]; n[idx].title = e.target.value; setWhyChooseUs(n); }} /></label>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Icon: 
                      <div style={{ marginTop: '0.25rem' }}>
                        <IconPicker value={card.icon} onChange={icon => { const n = [...whyChooseUs]; n[idx].icon = icon; setWhyChooseUs(n); }} />
                      </div>
                    </label>
                  </div>
                  
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} rows="2" value={card.description || ''} onChange={e => { const n = [...whyChooseUs]; n[idx].description = e.target.value; setWhyChooseUs(n); }} /></label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <input type="checkbox" checked={card.isActive !== false} onChange={e => { const n = [...whyChooseUs]; n[idx].isActive = e.target.checked; setWhyChooseUs(n); }} />
                      Feature Active
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setWhyChooseUs([...whyChooseUs, { title: 'New Feature', description: '', icon: 'Award', isActive: true }])} className="btn-hero-outline" style={{ justifySelf: 'start', marginTop: '0.5rem' }}>+ Add Feature</button>
            </div>
            <button className="btn-hero-primary" onClick={saveWhyChooseUs} style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem', width: '100%', marginTop: '2rem' }} disabled={savingWhyChooseUs}>{savingWhyChooseUs ? 'Saving...' : 'Save Why Choose Us'}</button>
          </div>

          {/* Leadership Message */}

          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Leadership Message</h3>
            <form onSubmit={saveLeadershipMessage} style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Badge: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.badge} onChange={e => setLeadershipMessage({...leadershipMessage, badge: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.title} onChange={e => setLeadershipMessage({...leadershipMessage, title: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Message: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.message} onChange={e => setLeadershipMessage({...leadershipMessage, message: e.target.value})} rows="4" /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.name} onChange={e => setLeadershipMessage({...leadershipMessage, name: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Photo Badge Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.photoBadgeTitle || "Principal's Photo"} onChange={e => setLeadershipMessage({...leadershipMessage, photoBadgeTitle: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Photo Badge Subtitle: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.photoBadgeSubtitle || "A Tradition of Excellence"} onChange={e => setLeadershipMessage({...leadershipMessage, photoBadgeSubtitle: e.target.value})} /></label>
              
              <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Principal Photo</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {(leadershipFile || leadershipMessage.imageUrl) && (
                    <img 
                      src={leadershipFile ? URL.createObjectURL(leadershipFile) : leadershipMessage.imageUrl} 
                      alt="Preview" 
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} 
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <input 
                      type="file" 
                      accept=".jpg,.jpeg,.png,.webp"
                      ref={leadershipFileRef}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file && file.size > 5 * 1024 * 1024) {
                          alert('File size exceeds 5MB limit.');
                          e.target.value = '';
                          return;
                        }
                        setLeadershipFile(file || null);
                      }}
                      style={{ width: '100%', padding: '0.5rem', background: '#fff', border: '1px border #cbd5e1', borderRadius: '0.25rem' }} 
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>JPG, PNG, WebP up to 5MB. {(leadershipMessage.imageUrl && !leadershipFile) && "Upload a new file to replace the existing image."}</p>
                    
                    {leadershipMessage.imageUrl && !leadershipFile && (
                      <button 
                        type="button" 
                        onClick={() => {
                          if(confirm('Are you sure you want to remove the current image?')) {
                             setLeadershipMessage({...leadershipMessage, imageUrl: ''});
                          }
                        }}
                        style={{ marginTop: '0.5rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Remove Existing Image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.btnText} onChange={e => setLeadershipMessage({...leadershipMessage, btnText: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.btnUrl} onChange={e => setLeadershipMessage({...leadershipMessage, btnUrl: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }} disabled={savingLeadership}>{savingLeadership ? 'Saving...' : 'Save Leadership Message'}</button>
            </form>
          </div>

          {/* CTA Section */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Call To Action (CTA) Section</h3>
            <form onSubmit={saveCtaSection} style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={ctaSection.title} onChange={e => setCtaSection({...ctaSection, title: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={ctaSection.description} onChange={e => setCtaSection({...ctaSection, description: e.target.value})} rows="3" /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 1 Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={ctaSection.btn1Text} onChange={e => setCtaSection({...ctaSection, btn1Text: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 1 URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={ctaSection.btn1Url} onChange={e => setCtaSection({...ctaSection, btn1Url: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 2 Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={ctaSection.btn2Text} onChange={e => setCtaSection({...ctaSection, btn2Text: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 2 URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={ctaSection.btn2Url} onChange={e => setCtaSection({...ctaSection, btn2Url: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }} disabled={savingCta}>{savingCta ? 'Saving...' : 'Save CTA Section'}</button>
            </form>
          </div>

          {/* Events Manager */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Events Manager</h3>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              {events.map(ev => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>{ev.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{new Date(ev.date).toLocaleDateString()} - {ev.location}</p>
                  </div>
                  <button onClick={() => handleDeleteEvent(ev.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                </div>
              ))}
              {events.length === 0 && <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center' }}>No events found.</p>}
            </div>
            <form onSubmit={handleAddEvent} style={{ display: 'grid', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontWeight: 600, color: '#334155' }}>Add New Event</h4>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} required /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Date: <input type="date" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} required /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Location: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#10b981', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }}>Add Event</button>
            </form>
          </div>
        </>
      )}
    </div>
    </div>
  );
}
