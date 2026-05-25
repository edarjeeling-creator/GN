import React from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';

const StudentPortal = () => {
  const { profile } = useAuth();

  return (
    <Layout>
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
        </div>
      </div>
    </Layout>
  );
};

export default StudentPortal;
