import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import '../public.css';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const MandatoryDisclosures = () => {
  const [disclosures, setDisclosures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisclosures();
  }, []);

  const fetchDisclosures = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'mandatory_disclosures').single();
      if (!error && data && data.value) {
        const parsed = JSON.parse(data.value);
        // filter active and sort by order
        const activeDocs = parsed.filter(d => d.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
        setDisclosures(activeDocs);
      }
    } catch (err) {
      console.error("Error fetching disclosures:", err);
    } finally {
      setLoading(false);
    }
  };

  // Group by category
  const grouped = disclosures.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <div className="w-full">
      <div className="hero-section" style={{ minHeight: '30vh', paddingTop: '4rem', background: 'linear-gradient(to right, #1e293b, #0f172a)' }}>
        <div className="public-container relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <ShieldCheck size={48} style={{ margin: '0 auto 1rem', color: '#38bdf8' }} />
            <h1 className="hero-title" style={{ fontSize: '3rem' }}>Mandatory Disclosures</h1>
            <p className="hero-subtitle" style={{ marginBottom: 0 }}>Public information and compliance documents.</p>
          </motion.div>
        </div>
      </div>
      
      <div className="public-container" style={{ padding: '4rem 1rem', minHeight: '50vh' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Loading documents...</div>
        ) : disclosures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>No documents available at this time.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '800px', margin: '0 auto' }}>
            {categories.map(category => (
              <div key={category}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-public)' }}>
                  {category}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {grouped[category].map(doc => (
                    <a 
                      key={doc.id} 
                      href={doc.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bento-card"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        textDecoration: 'none', 
                        padding: '1.5rem',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '0.5rem', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{doc.title}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click to view document</p>
                      </div>
                      <Download size={20} color="#94a3b8" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MandatoryDisclosures;
