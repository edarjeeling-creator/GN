import React from 'react';

const DashboardSection = ({ title, icon, children, expandable = true }) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0 16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <div style={{ color: 'var(--mobile-text-primary)' }}>{icon}</div>}
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: 'var(--mobile-text-primary)',
            margin: 0
          }}>
            {title}
          </h2>
        </div>
        {expandable && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mobile-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        )}
      </div>
      <div style={{ padding: '0 16px' }}>
        {children}
      </div>
    </div>
  );
};

export default DashboardSection;
