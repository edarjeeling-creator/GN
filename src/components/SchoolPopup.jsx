import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Volume2, VolumeX, AlertTriangle, ExternalLink, Play } from 'lucide-react';

const SchoolPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupConfig, setPopupConfig] = useState({
    enabled: false,
    category: 'admission', // 'emergency', 'admission', 'event'
    title: 'Admissions Open 2026-27',
    description: 'Join the premier ICSE Institution in Darjeeling. Watch our campus virtual tour and apply today!',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Default fallback mock video
    buttonLabel: 'Apply Online',
    buttonUrl: '/admissions'
  });

  const [isMuted, setIsMuted] = useState(true);
  const [showVideo, setShowVideo] = useState(false); // Lazy-loads iframe only after click for optimal speed!

  useEffect(() => {
    const fetchPopupConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'active_homepage_popup')
          .single();

        if (data && data.value) {
          const parsed = JSON.parse(data.value);
          setPopupConfig(parsed);
          
          if (parsed.enabled) {
            triggerPopupDelayed(parsed);
          }
        } else {
          // If no active row exists in DB, keep disabled as default
          console.log("No active home popup configuration in site_settings. Popup remains disabled.");
        }
      } catch (err) {
        console.warn("Failed to load active homepage popup setting:", err);
      }
    };

    const triggerPopupDelayed = (config) => {
      // 1. Check if user already dismissed it this session
      const isDismissed = sessionStorage.getItem('campusPopupDismissed');
      
      // Emergency notices bypass all suppression filters and show on every single visit!
      if (config.category === 'emergency' || !isDismissed) {
        // 2. Delayed entrance after 4 seconds for natural UX
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 4000);
        return () => clearTimeout(timer);
      }
    };

    fetchPopupConfig();
  }, []);

  // Escape key close listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('campusPopupDismissed', 'true');
  };

  if (!isOpen || !popupConfig.enabled) return null;

  const isEmergency = popupConfig.category === 'emergency';
  const isEvent = popupConfig.category === 'event';

  // Master styling maps
  const backdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    padding: '1.5rem',
    boxSizing: 'border-box'
  };

  const modalStyle = {
    backgroundColor: isEmergency ? '#fef2f2' : '#ffffff',
    border: isEmergency ? '2px solid #ef4444' : '1px solid #e2e8f0',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
    width: '100%',
    maxWidth: '640px',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    animation: 'popup-zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  };

  const titleStyle = {
    fontSize: isEmergency ? '1.5rem' : '1.75rem',
    fontWeight: 800,
    color: isEmergency ? '#991b1b' : '#0f172a',
    margin: 0,
    letterSpacing: '-0.025em',
    lineHeight: '1.2'
  };

  // Convert watch standard YouTube link to embed format
  const getEmbedUrl = (url) => {
    if (!url) return '';
    let embed = url;
    if (url.includes('watch?v=')) {
      embed = url.replace('watch?v=', 'embed/');
    } else if (url.includes('youtu.be/')) {
      embed = url.replace('youtu.be/', 'youtube.com/embed/');
    }
    // Append parameters for muted autoplay if enabled
    return `${embed}?autoplay=1&mute=${isMuted ? 1 : 0}&rel=0`;
  };

  return (
    <div style={backdropStyle} onClick={handleClose}>
      
      {/* Dynamic Keyframe Animations */}
      <style>{`
        @keyframes popup-zoom {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div 
        style={modalStyle} 
        onClick={(e) => e.stopPropagation()} // Prevents closing modal when clicking modal content
      >
        
        {/* Urgent Emergency Alert Header */}
        {isEmergency && (
          <div style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '0.625rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 'bold',
            fontSize: '0.875rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            <AlertTriangle size={16} /> Urgent School Notice
          </div>
        )}

        {/* Dismiss Button */}
        <button 
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: isEmergency ? '3.5rem' : '1rem',
            right: '1rem',
            background: 'rgba(15, 23, 42, 0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#475569',
            transition: 'background 0.2s',
            zIndex: 30
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.05)'}
        >
          <X size={18} />
        </button>

        {/* Content Body */}
        <div style={{ padding: '2rem 1.75rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <h2 style={titleStyle}>{popupConfig.title}</h2>
            <p style={{
              color: isEmergency ? '#7f1d1d' : '#475569',
              fontSize: '0.975rem',
              lineHeight: '1.5',
              marginTop: '0.5rem',
              marginBottom: 0
            }}>
              {popupConfig.description}
            </p>
          </div>

          {/* YouTube Video Tour / Stream Player Section */}
          {popupConfig.videoUrl && !isEmergency && (
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#0f172a',
              borderRadius: '10px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
            }}>
              {!showVideo ? (
                /* Lazy-load Poster Placeholder (Saves massive page load speeds!) */
                <div 
                  onClick={() => setShowVideo(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'linear-gradient(to right, #1e3a8a, #0f172a)',
                    color: '#ffffff',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    padding: '1.25rem',
                    borderRadius: '50%',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.2s',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <Play size={36} fill="currentColor" style={{ marginLeft: '4px' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#93c5fd', marginTop: '1rem', textTransform: 'uppercase' }}>
                    Click to Play School Tour
                  </span>
                </div>
              ) : (
                /* The Live YouTube iFrame Embed */
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {!popupConfig.videoUrl.includes('youtube') && !popupConfig.videoUrl.includes('youtu.be') ? (
                    <video
                      src={popupConfig.videoUrl}
                      autoPlay
                      muted={isMuted}
                      controls
                      loop
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', border: 'none' }}
                    />
                  ) : (
                    <iframe
                      width="100%"
                      height="100%"
                      src={getEmbedUrl(popupConfig.videoUrl)}
                      title="School video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{ border: 'none' }}
                    />
                  )}
                  {/* Audio Mute Controller Toggle */}
                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                      position: 'absolute',
                      bottom: '0.75rem',
                      right: '0.75rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      color: 'white',
                      border: 'none',
                      padding: '0.375rem 0.625rem',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                      zIndex: 20
                    }}
                  >
                    {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Footer Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.25rem'
          }}>
            <button 
              onClick={handleClose}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                backgroundColor: isEmergency ? 'transparent' : '#f1f5f9',
                color: isEmergency ? '#b91c1c' : '#475569',
                border: isEmergency ? '1px solid #fca5a5' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Close
            </button>
            
            {popupConfig.buttonUrl && (
              <a 
                href={popupConfig.buttonUrl}
                style={{
                  padding: '0.625rem 1.5rem',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  backgroundColor: isEmergency ? '#b91c1c' : '#1e3a8a',
                  color: '#ffffff',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = isEmergency ? '#991b1b' : '#1d4ed8'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = isEmergency ? '#b91c1c' : '#1e3a8a'}
              >
                {popupConfig.buttonLabel || "Learn More"} <ExternalLink size={12} />
              </a>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default SchoolPopup;
