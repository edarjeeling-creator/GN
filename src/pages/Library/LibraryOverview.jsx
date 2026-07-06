import React from 'react';
import { BookOpen, Users, Clock, AlertTriangle } from 'lucide-react';

const LibraryOverview = () => {
  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Library Overview</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#dbeafe', color: '#2563eb', padding: '1rem', borderRadius: '50%' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Total Books</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>-</h3>
          </div>
        </div>
        
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#dcfce7', color: '#16a34a', padding: '1rem', borderRadius: '50%' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Active Members</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>-</h3>
          </div>
        </div>
        
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', padding: '1rem', borderRadius: '50%' }}>
            <Clock size={24} />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Books Issued</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>-</h3>
          </div>
        </div>
        
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '50%' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Overdue</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>-</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryOverview;
