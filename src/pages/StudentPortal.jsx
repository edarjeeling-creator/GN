import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

import { Link } from 'react-router-dom';

const StudentPortal = () => {
  const { profile } = useAuth();
  const { students, featureAccess } = useData();

  const studentData = students.find(s => s.uid === profile?.id);
  const classId = studentData?.class_id;

  const isPythonEnabled = featureAccess && 
    Array.isArray(featureAccess) && 
    featureAccess.some(f => f.feature_name === 'python_portal' && f.user_type === 'class' && f.class_id === classId && f.is_enabled);

  return (
    <>
      <div className="portal-container" style={{ padding: '2rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Student Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {profile?.name}</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Study Materials Widget */}
          <Link to="/study-materials" className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border-color)' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Study Materials</h2>
            <p style={{ color: 'var(--text-secondary)' }}>View and download materials uploaded by your teachers.</p>
          </Link>

          {/* Assignments Widget */}
          <Link to="/assignments" className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border-color)' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Assignments</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Submit your assignments and view teacher feedback.</p>
          </Link>
          
          {/* Marks Widget */}
          <Link to="/result" className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border-color)' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>My Marks</h2>
            <p style={{ color: 'var(--text-secondary)' }}>View your report cards and exam results.</p>
          </Link>
          
          {/* Python Portal Widget */}
          {isPythonEnabled && (
            <Link to="/python-student" className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid #bfdbfe' }} onMouseOver={e=>e.currentTarget.style.borderColor='#3b82f6'} onMouseOut={e=>e.currentTarget.style.borderColor='#bfdbfe'}>
              <div className="flex items-center gap-2 mb-4">
                <span style={{ fontSize: '1.5rem' }}>🐍</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af', margin: 0 }}>Python Pathshala</h2>
              </div>
              <p style={{ color: '#3b82f6', fontWeight: 500 }}>Learn coding, practice in the browser, and earn badges!</p>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default StudentPortal;
