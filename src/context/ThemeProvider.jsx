import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [siteBranding, setSiteBranding] = useState({
    siteName: 'SMARTGRADES ICSE SCHOOL',
    siteMotto: '',
    logoUrl: '/logo.png',
    faviconUrl: '/vite.svg',
  });

  const [themeColors, setThemeColors] = useState({
    heading: '#0f172a',
    body: '#64748b',
    button: '#2563eb', // Will map to primary btn color if needed globally
    nav: '#1f2937',
    footer: '#e5e7eb',
    link: '#2563eb',
    hover: '#1d4ed8'
  });

  const [footerSettings, setFooterSettings] = useState({
    contact: {
      phone: '+91 XXXXX XXXXX',
      alternatePhone: '',
      email: 'info@smartgrades.edu.in',
      admissionContact: '',
      officeHours: 'Mon–Fri: 8:00 AM – 4:00 PM'
    },
    quickLinks: [
      { id: '1', label: 'Home', url: '/', active: true },
      { id: '2', label: 'About Us', url: '/about', active: true },
      { id: '3', label: 'Admissions', url: '/admissions', active: true },
      { id: '4', label: 'Academics', url: '/academics', active: true },
      { id: '5', label: 'Notices', url: '/notices', active: true },
      { id: '6', label: 'Contact Us', url: '/contact', active: true }
    ],
    socialMedia: {
      facebook: '',
      instagram: '',
      youtube: '',
      linkedin: '',
      twitter: ''
    },
    findUs: {
      address: 'SmartGrades ICSE School\nDarjeeling / West Bengal',
      landmark: '',
      pinCode: '',
      stats: '1200+ Students | 75+ Teachers | 98% Results | 25 Years of Excellence'
    },
    legal: {
      affiliation: 'Affiliated to CISCE, New Delhi (WB046)',
      copyright: '© 2026 SmartGrades School. All rights reserved.'
    }
  });

  const [mainMenu, setMainMenu] = useState([
    { id: '1', label: 'ABOUT US', url: '/about', type: 'simple', isActive: true, children: [] },
    { id: '2', label: 'FACULTY', url: '/faculty', type: 'simple', isActive: true, children: [] },
    { id: '3', label: 'ACADEMICS', url: '/academics', type: 'simple', isActive: true, children: [] },
    { id: '4', label: 'ADMISSIONS', url: '/admissions', type: 'simple', isActive: true, children: [] },
    { id: '5', label: 'GALLERY', url: '/gallery', type: 'simple', isActive: true, children: [] },
    { id: '6', label: 'NOTICES/CIRCULARS', url: '/notices', type: 'simple', isActive: true, children: [] },
    { id: '7', label: 'CONTACT US', url: '/contact', type: 'simple', isActive: true, children: [] }
  ]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThemeSettings();
  }, []);

  const fetchThemeSettings = async () => {
    try {
      const { data: brandingData } = await supabase.from('site_settings').select('value').eq('key', 'site_branding_v2').single();
      if (brandingData && brandingData.value) {
        setSiteBranding(JSON.parse(brandingData.value));
      }

      const { data: colorsData } = await supabase.from('site_settings').select('value').eq('key', 'theme_colors').single();
      if (colorsData && colorsData.value) {
        setThemeColors(JSON.parse(colorsData.value));
      }

      const { data: footerData } = await supabase.from('site_settings').select('value').eq('key', 'footer_settings').single();
      if (footerData && footerData.value) {
        setFooterSettings(JSON.parse(footerData.value));
      }

      const { data: menuData } = await supabase.from('site_settings').select('value').eq('key', 'main_navigation').single();
      if (menuData && menuData.value) {
        setMainMenu(JSON.parse(menuData.value));
      }
    } catch (err) {
      console.error("Failed to fetch theme settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Inject CSS variables
    const root = document.documentElement;
    root.style.setProperty('--heading-color', themeColors.heading);
    root.style.setProperty('--body-text-color', themeColors.body);
    root.style.setProperty('--button-text-color', themeColors.button);
    root.style.setProperty('--nav-text-color', themeColors.nav);
    root.style.setProperty('--footer-text-color', themeColors.footer);
    root.style.setProperty('--link-color', themeColors.link);
    root.style.setProperty('--hover-color', themeColors.hover);

    // Update document title
    document.title = siteBranding.siteName;

    // Update favicon
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    if(siteBranding.faviconUrl) {
      link.href = siteBranding.faviconUrl;
    }
  }, [themeColors, siteBranding]);

  return (
    <ThemeContext.Provider value={{ siteBranding, themeColors, footerSettings, mainMenu, fetchThemeSettings }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
};
