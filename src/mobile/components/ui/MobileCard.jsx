import React from 'react';

const MobileCard = ({ children, className = '', style = {}, onClick }) => {
  return (
    <div 
      className={`mobile-card ${className}`}
      style={{
        backgroundColor: 'var(--mobile-card-bg)',
        borderRadius: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        padding: '16px',
        ...style
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default MobileCard;
