import React from 'react';
import { Star, User, Lock, Globe, RefreshCw, Smartphone, LogOut } from 'lucide-react';
import MobileCard from '../components/ui/MobileCard';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SettingItem = ({ icon, label, subtext, onClick, color = 'var(--mobile-text-primary)' }) => (
  <div 
    onClick={onClick}
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '16px 0',
      borderBottom: '1px solid var(--mobile-border)',
      cursor: 'pointer'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ color: color }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '15px', fontWeight: 500, color: color }}>{label}</span>
        {subtext && <span style={{ fontSize: '12px', color: 'var(--mobile-text-secondary)', marginTop: '2px' }}>{subtext}</span>}
      </div>
    </div>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mobile-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  </div>
);

const MobileSettings = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: '24px 16px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--mobile-text-primary)' }}>
        Settings
      </h2>

      <MobileCard style={{ padding: '0 16px', marginBottom: '24px' }}>
        <SettingItem 
          icon={<Star size={20} />} 
          label="Rate us on Play Store" 
          onClick={() => window.open('https://play.google.com/store', '_blank')}
        />
        <SettingItem 
          icon={<User size={20} />} 
          label="Change username" 
        />
        <SettingItem 
          icon={<Lock size={20} />} 
          label="Change password" 
        />
        <SettingItem 
          icon={<Globe size={20} />} 
          label="Change language" 
          subtext="English"
        />
        <SettingItem 
          icon={<RefreshCw size={20} />} 
          label="Sync data" 
          subtext="Last sync 2 mins ago"
        />
        <SettingItem 
          icon={<Smartphone size={20} />} 
          label="App Version" 
          subtext="v2.0.4"
          onClick={() => {}}
        />
      </MobileCard>

      <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--mobile-text-secondary)', marginLeft: '16px', display: 'block', marginBottom: '16px' }}>
        Preferences
      </span>

      <MobileCard style={{ padding: '0 16px', marginBottom: '32px' }}>
        <div 
          onClick={handleLogout}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            padding: '16px 0',
            cursor: 'pointer'
          }}
        >
          <div style={{ color: '#ef4444' }}>
            <LogOut size={20} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 500, color: '#ef4444' }}>Logout</span>
        </div>
      </MobileCard>
    </div>
  );
};

export default MobileSettings;
