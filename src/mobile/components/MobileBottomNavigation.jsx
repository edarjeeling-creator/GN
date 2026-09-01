import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useData } from '../../context/DataContext';

const MobileBottomNavigation = ({ onMenuClick }) => {
  const { profile } = useAuth();
  const { unreadCounts } = useChat();
  const { students } = useData();
  
  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase())
  );

  const totalChatUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);

  // In the real app, we might also want to add general unread notifications to this total
  // For the badge, we show "99+" if it's over 99
  const displayBadge = totalChatUnread > 99 ? '99+' : totalChatUnread;
  
  const navItems = [
    { 
      id: 'menu', 
      label: 'Menu', 
      icon: <Menu size={24} />,
      onClick: onMenuClick
    },
    { 
      id: 'home', 
      label: 'Home', 
      icon: <Home size={24} />,
      to: '/m/dashboard' 
    },
    { 
      id: 'message', 
      label: 'Message', 
      icon: <MessageSquare size={24} />,
      to: '/m/messages',
      badge: totalChatUnread > 0 ? displayBadge : null
    },
    { 
      id: 'profile', 
      label: profile?.name?.split(' ')[0]?.toUpperCase() || 'PROFILE', 
      to: '/m/profile',
      isProfile: true,
      image: profile?.picture_url || studentData?.picture_url
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '16px',
      right: '16px',
      backgroundColor: '#ffffff',
      borderRadius: '40px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      zIndex: 40,
      paddingBottom: 'calc(12px + var(--mobile-safe-bottom, 0px))' // safe area logic
    }}>
      {navItems.map(item => {
        if (item.onClick) {
          // Action button (like Menu)
          return (
            <button 
              key={item.id}
              onClick={item.onClick}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--mobile-text-secondary)',
                padding: '4px',
                width: '64px'
              }}
            >
              <div style={{ position: 'relative' }}>
                {item.icon}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 500 }}>{item.label}</span>
            </button>
          );
        }

        // Nav Link
        return (
          <NavLink 
            key={item.id}
            to={item.to}
            style={({ isActive }) => ({
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: isActive ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)',
              padding: '4px',
              width: '64px',
              transition: 'color 0.2s'
            })}
          >
            {({ isActive }) => (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {item.isProfile ? (
                    <div style={{
                      width: '26px', 
                      height: '26px', 
                      borderRadius: '50%', 
                      overflow: 'hidden',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--mobile-text-secondary)',
                      fontSize: '10px',
                      border: isActive ? '2px solid var(--mobile-primary)' : '2px solid transparent'
                    }}>
                      {item.image ? (
                        <img src={item.image} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>{item.label.charAt(0)}</span>
                      )}
                    </div>
                  ) : (
                    item.icon
                  )}
                  {item.badge && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-8px',
                      backgroundColor: '#ff4d4f',
                      color: 'white',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      padding: '2px 5px',
                      borderRadius: '10px',
                      border: '2px solid white'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
};

export default MobileBottomNavigation;
