import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MobileCard from './ui/MobileCard';

const AccordionSection = ({ icon, title, children, iconBg, iconColor }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <MobileCard 
      style={{ 
        padding: '16px', 
        marginBottom: '16px',
        cursor: 'pointer'
      }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: iconBg || '#f3f4f6',
            color: iconColor || '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </div>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mobile-text-primary)' }}>
            {title}
          </span>
        </div>
        <div>
          {isOpen ? <ChevronUp size={20} color="var(--mobile-text-secondary)" /> : <ChevronDown size={20} color="var(--mobile-text-secondary)" />}
        </div>
      </div>
      
      {isOpen && children && (
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent accordion from closing when clicking inside content
          style={{ 
            marginTop: '16px', 
            paddingTop: '16px', 
            borderTop: '1px solid var(--mobile-border)' 
          }}
        >
          {children}
        </div>
      )}
    </MobileCard>
  );
};

export default AccordionSection;
