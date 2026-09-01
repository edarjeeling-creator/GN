import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  ListTodo, 
  BookOpen, 
  CalendarDays, 
  Calendar, 
  Image as ImageIcon, 
  Globe,
  ChevronDown,
  MinusCircle,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeProvider';

const MobileDrawer = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { students, classes } = useData();
  const { siteBranding } = useTheme();
  const navigate = useNavigate();

  const [expandedSections, setExpandedSections] = useState({
    learning: true,
    operations: true,
    resources: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase())
  );
  
  const displayName = profile?.name || studentData?.name || 'STUDENT';
  const roleDisplay = profile?.role === 'student' ? 'Student' : (profile?.role || 'User');

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  const SectionHeader = ({ title, sectionKey }) => (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '16px 24px 8px 24px',
        cursor: 'pointer'
      }}
      onClick={() => toggleSection(sectionKey)}
    >
      <span style={{ 
        color: '#888', 
        fontSize: '12px', 
        fontWeight: 'bold', 
        letterSpacing: '0.5px' 
      }}>
        {title}
      </span>
      {expandedSections[sectionKey] ? (
        <MinusCircle size={18} color="#888" strokeWidth={1.5} />
      ) : (
        <ChevronDown size={18} color="#888" strokeWidth={1.5} />
      )}
    </div>
  );

  const DrawerItem = ({ icon, label, path, isExternal = false }) => (
    <div 
      onClick={() => isExternal ? window.open(path, '_blank') : handleNavigation(path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 24px',
        gap: '16px',
        color: 'var(--mobile-text-primary)',
        cursor: 'pointer'
      }}
    >
      <div style={{ color: 'var(--mobile-text-primary)' }}>
        {icon}
      </div>
      <span style={{ fontSize: '15px', fontWeight: 500 }}>{label}</span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className="mobile-drawer-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 50,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="mobile-drawer-content"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '80%',
          maxWidth: '320px',
          backgroundColor: '#ffffff',
          zIndex: 51,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        {/* School Identity */}
        <div style={{ padding: '32px 24px 24px 24px' }}>
          <img 
            src={siteBranding?.logoUrl || "/logo.png"} 
            alt="School Logo" 
            style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '16px' }} 
          />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>
            {siteBranding?.siteName || 'Loreto Convent'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--mobile-text-secondary)', lineHeight: 1.4 }}>
            {siteBranding?.address || 'Darjeeling, West Bengal, 734101,\nDarjeeling'}
          </p>
        </div>

        {/* Student Identity */}
        <div style={{ 
          padding: '0 24px 16px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid var(--mobile-border)'
        }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)' }}>
              {roleDisplay}
            </div>
          </div>
          <ChevronDown size={20} color="var(--mobile-text-secondary)" />
        </div>

        {/* Navigation Items */}
        <div style={{ padding: '8px 0 24px 0', flex: 1 }}>
          
          <DrawerItem 
            icon={<Users size={22} strokeWidth={1.5} />} 
            label="Survey" 
            path="/m/dashboard" // Default to dashboard for placeholder
          />

          <SectionHeader title="LEARNING & ASSESSMENT" sectionKey="learning" />
          {expandedSections.learning && (
            <>
              <DrawerItem 
                icon={<ListTodo size={22} strokeWidth={1.5} />} 
                label="Assignment" 
                path="/m/assignments" 
              />
              <DrawerItem 
                icon={<BookOpen size={22} strokeWidth={1.5} />} 
                label="Syllabus" 
                path="/m/syllabus" 
              />
            </>
          )}

          <SectionHeader title="OPERATIONS & TASK" sectionKey="operations" />
          {expandedSections.operations && (
            <>
              <DrawerItem 
                icon={<CalendarDays size={22} strokeWidth={1.5} />} 
                label="Timetable" 
                path="/m/timetable" 
              />
              <DrawerItem 
                icon={<Calendar size={22} strokeWidth={1.5} />} 
                label="Calendar" 
                path="/m/calendar" 
              />
            </>
          )}

          <SectionHeader title="LEARNING & OTHER RESOURCES" sectionKey="resources" />
          {expandedSections.resources && (
            <>
              <DrawerItem 
                icon={<ImageIcon size={22} strokeWidth={1.5} />} 
                label="Gallery" 
                path="/m/dashboard" 
              />
              <DrawerItem 
                icon={<Globe size={22} strokeWidth={1.5} />} 
                label="Website" 
                path="/" 
                isExternal={false} // Goes back to web layout
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileDrawer;
