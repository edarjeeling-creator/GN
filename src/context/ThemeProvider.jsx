import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [siteBranding, setSiteBranding] = useState({
    siteName: 'SMARTGRADES ICSE SCHOOL',
    logoUrl: '/logo.png',
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
  }, [themeColors, siteBranding]);

  return (
    <ThemeContext.Provider value={{ siteBranding, themeColors, fetchThemeSettings }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
};
