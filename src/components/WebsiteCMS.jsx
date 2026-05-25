import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Image as ImageIcon, Users, UploadCloud, Loader2, Monitor, Palette, Layout } from 'lucide-react';

export default function WebsiteCMS() {
  const [faculty, setFaculty] = useState([]);
  const [gallery, setGallery] = useState([]);
  
  // Faculty State
  const [newFaculty, setNewFaculty] = useState({ name: '', designation: '', department: '', bio: '' });
  const [facultyFile, setFacultyFile] = useState(null);
  const [uploadingFaculty, setUploadingFaculty] = useState(false);
  const facultyFileRef = useRef(null);

  // Gallery State
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
    btnShape: '2rem' // rounded-full default
  });
  const [savingHeroStyle, setSavingHeroStyle] = useState(false);

  // Site Branding State (v2)
  const [siteBranding, setSiteBranding] = useState({
    siteName: 'SMARTGRADES ICSE SCHOOL',
    siteMotto: '',
    logoUrl: '/logo.png'
  });
  const [savingSiteBranding, setSavingSiteBranding] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const logoFileRef = useRef(null);

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

  useEffect(() => {
    fetchFaculty();
    fetchGallery();
    fetchHeroSlides();
    fetchHeroStyling();
    fetchSiteBranding();
    fetchThemeColors();
    fetchFooterSettings();
  }, []);

  const fetchHeroStyling = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'hero_styling').single();
    if (data && data.value) {
      setHeroStyle(JSON.parse(data.value));
    }
  };

  const saveHeroStyling = async (e) => {
    e.preventDefault();
    setSavingHeroStyle(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'hero_styling', value: JSON.stringify(heroStyle) });
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
      
      const newBranding = { ...siteBranding, logoUrl: currentLogoUrl };
      
      const { error } = await supabase.from('site_settings').upsert({ key: 'site_branding_v2', value: JSON.stringify(newBranding) });
      if (error) throw error;
      
      setSiteBranding(newBranding);
      setLogoFile(null);
      if (logoFileRef.current) logoFileRef.current.value = '';
      
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
      const { error } = await supabase.from('site_settings').upsert({ key: 'theme_colors', value: JSON.stringify(themeColors) });
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

  const saveFooterSettings = async (e) => {
    if(e) e.preventDefault();
    setSavingFooterSettings(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({ key: 'footer_settings', value: JSON.stringify(footerSettings) });
      if (error) throw error;
      alert("Footer settings saved successfully!");
    } catch (err) {
      alert("Failed to save footer settings: " + err.message);
    } finally {
      setSavingFooterSettings(false);
    }
  };

  const resetBranding = async () => {
    if (!window.confirm("Are you sure you want to reset branding to default?")) return;
    setSiteBranding({ siteName: 'SMARTGRADES ICSE SCHOOL', siteMotto: '', logoUrl: '/logo.png' });
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
        await supabase.from('hero_slides').insert([{ media_url: imageUrl }]);
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

        await supabase.from('gallery').insert([{
          title: title,
          category: galleryCategory,
          year: galleryYear,
          image_url: imageUrl
        }]);

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
      
      {/* Homepage Hero Manager */}
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
                 <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.5rem', color: '#94a3b8' }}>
                   No custom slides added. Default graphic is shown.
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Content & Style Manager */}
      <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Monitor size={20} color="#3b82f6" /> Hero Content & Style Manager
        </h3>
        <form onSubmit={saveHeroStyling} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* Texts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Text Content</h4>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Subtitle</label>
              <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.subtitle} onChange={e => setHeroStyle({...heroStyle, subtitle: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Main Title</label>
              <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.title} onChange={e => setHeroStyle({...heroStyle, title: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Description</label>
              <textarea rows="2" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.description} onChange={e => setHeroStyle({...heroStyle, description: e.target.value})}></textarea>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Buttons</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary Text</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.btnPrimaryText} onChange={e => setHeroStyle({...heroStyle, btnPrimaryText: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Primary Link</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.btnPrimaryLink} onChange={e => setHeroStyle({...heroStyle, btnPrimaryLink: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Secondary Text</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.btnSecondaryText} onChange={e => setHeroStyle({...heroStyle, btnSecondaryText: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Secondary Link</label>
                <input type="text" className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.btnSecondaryLink} onChange={e => setHeroStyle({...heroStyle, btnSecondaryLink: e.target.value})} />
              </div>
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
            </div>


            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Button Shape</label>
              <select className="input-field" style={{ width: '100%', background: '#f8fafc' }} value={heroStyle.btnShape} onChange={e => setHeroStyle({...heroStyle, btnShape: e.target.value})}>
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

      {/* Site Branding Manager */}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Current Logo</label>
            <div style={{ background: '#e2e8f0', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src={siteBranding.logoUrl || '/logo.png'} alt="Logo" style={{ height: '4rem', width: '4rem', objectFit: 'contain', background: 'white', borderRadius: '0.25rem', padding: '0.25rem' }} />
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>This is the logo currently displayed on the site.</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Upload New Logo (Optional)</label>
            <input 
              type="file" 
              accept="image/*" 
              ref={logoFileRef}
              onChange={(e) => setLogoFile(e.target.files[0])}
              className="input-field" 
            />
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

      {/* Theme Colors Manager */}
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

      {/* Footer Settings Manager */}
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
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="#8b5cf6" /> Faculty Manager
        </h3>
        <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <input type="text" placeholder="Name" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.name} onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="text" placeholder="Designation" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.designation} onChange={e => setNewFaculty({...newFaculty, designation: e.target.value})} required />
            <input type="text" placeholder="Department" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.department} onChange={e => setNewFaculty({...newFaculty, department: e.target.value})} />
          </div>
          
          <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '0.5rem', background: '#f8fafc' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Profile Photo (Optional)</label>
            <input 
              type="file" 
              accept="image/*"
              ref={facultyFileRef}
              onChange={e => setFacultyFile(e.target.files[0])}
              style={{ width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <textarea placeholder="Short Bio" rows="2" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.bio} onChange={e => setNewFaculty({...newFaculty, bio: e.target.value})}></textarea>
          
          <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={uploadingFaculty}>
            {uploadingFaculty ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Plus size={16} /> Add Faculty</>}
          </button>
        </form>

        <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faculty.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
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

      {/* Gallery Manager */}
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon size={20} color="#10b981" /> Bulk Photo Gallery Manager
        </h3>
        <form onSubmit={handleAddPhotos} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="text" placeholder="Category (e.g. Sports, Academics)" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={galleryCategory} onChange={e => setGalleryCategory(e.target.value)} required />
            <input type="text" placeholder="Year (e.g. 2026)" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={galleryYear} onChange={e => setGalleryYear(e.target.value)} required />
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
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
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
    </div>
  );
}
