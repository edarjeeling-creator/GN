import React from 'react';
import { Bell, SlidersHorizontal, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const MobileHeader = ({ onMenuClick }) => {
  const { profile } = useAuth();
  const { students } = useData();
  const navigate = useNavigate();

  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase())
  );

  const profileImage = profile?.picture_url || studentData?.picture_url;
  const displayName = profile?.name || studentData?.name || 'STUDENT';

  return (
    <div style={{
      backgroundColor: 'var(--mobile-primary)',
      padding: '16px',
      paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))', // safe area handling
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: 'white'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#e5e7eb',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mobile-text-secondary)',
          border: '2px solid rgba(255,255,255,0.4)'
        }}>
          {profileImage ? (
            <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{displayName.charAt(0)}</span>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>Hi,</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {displayName}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => navigate('/m/messages')}
          style={{ background: 'none', border: 'none', color: 'white', padding: 0 }}
        >
          <Bell size={24} />
        </button>
        <button 
          style={{ background: 'none', border: 'none', color: 'white', padding: 0 }}
        >
          <SlidersHorizontal size={24} />
        </button>
        <button 
          onClick={() => navigate('/m/settings')}
          style={{ background: 'none', border: 'none', color: 'white', padding: 0 }}
        >
          <Settings size={24} />
        </button>
      </div>
    </div>
  );
};

export default MobileHeader;
