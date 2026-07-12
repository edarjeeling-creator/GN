import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Plus, Edit2, CheckCircle, Trash2, Settings, FileText } from 'lucide-react';

const DEFAULT_SETTINGS = {
  title: 'REPORT CARD',
  academicYear: '2025-2026',
  layoutTemplate: 'midterm-standard',
  logoUrl: '',
  principalSignatureUrl: '',
  classTeacherSignatureUrl: '',
  promotionRuleText: 'Promoted to the next class.',
  gradeSystem: 'standard', // standard, icse, cbse
  showAttendance: true,
  showRemarks: true,
  showRank: false,
  showPercentage: true,
  showQrCode: false,
  margins: {
    top: '10mm',
    bottom: '10mm',
    left: '10mm',
    right: '10mm'
  }
};

const ReportCardCMS = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'Mid-Term',
    is_active: false,
    settings: DEFAULT_SETTINGS
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('report_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingTemplate(null);
    setFormData({
      name: 'New Template',
      type: 'Mid-Term',
      is_active: false,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    });
  };

  const handleEdit = (template) => {
    setIsCreating(false);
    setEditingTemplate(template.id);
    
    // Ensure backwards compatibility with older JSON structures if needed
    const safeSettings = { ...DEFAULT_SETTINGS, ...(template.settings || {}) };
    if (!safeSettings.margins) safeSettings.margins = DEFAULT_SETTINGS.margins;
    
    setFormData({
      name: template.name,
      type: template.type,
      is_active: template.is_active,
      settings: safeSettings
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      const { error } = await supabase.from('report_templates').delete().eq('id', id);
      if (error) throw error;
      fetchTemplates();
      if (editingTemplate === id) setEditingTemplate(null);
    } catch (err) {
      console.error(err);
      alert('Error deleting template');
    }
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        const { error } = await supabase.from('report_templates').insert({
          name: formData.name,
          type: formData.type,
          is_active: formData.is_active,
          settings: formData.settings
        });
        if (error) throw error;
      } else if (editingTemplate) {
        const { error } = await supabase.from('report_templates').update({
          name: formData.name,
          type: formData.type,
          is_active: formData.is_active,
          settings: formData.settings
        }).eq('id', editingTemplate);
        if (error) throw error;
      }
      
      alert('Template saved successfully!');
      setEditingTemplate(null);
      setIsCreating(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert('Error saving template: ' + err.message);
    }
  };

  const updateSetting = (key, value) => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value }
    }));
  };

  const updateMargin = (key, value) => {
    setFormData(prev => ({
      ...prev,
      settings: { 
        ...prev.settings, 
        margins: { ...prev.settings.margins, [key]: value }
      }
    }));
  };

  if (loading) return <div>Loading CMS...</div>;

  return (
    <div className="bento-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Report Card CMS</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Design and configure dynamic report card templates.</p>
        </div>
        
        {!editingTemplate && !isCreating && (
          <button onClick={handleCreateNew} className="btn-hero-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem' }}>
            <Plus size={18} /> Create Template
          </button>
        )}
      </div>

      {(editingTemplate || isCreating) ? (
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #cbd5e1' }}>
            <h4 style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} /> {isCreating ? 'New Template' : 'Edit Template'}
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setEditingTemplate(null); setIsCreating(false); }} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}><Save size={16} /> Save</button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Core Settings */}
            <div>
              <h5 style={{ fontWeight: 600, marginBottom: '1rem', color: '#475569' }}>General Metadata</h5>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template Name (Internal)</label>
                <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              
              <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Term Type</label>
                  <select className="input-field" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                    <option value="Mid-Term">Mid-Term</option>
                    <option value="Final-Term">Final-Term</option>
                    <option value="Annual">Annual / Consolidated</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                    Active (Default for Type)
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="block text-sm font-medium text-slate-700 mb-1">Layout Engine</label>
                <select className="input-field" value={formData.settings.layoutTemplate} onChange={e => updateSetting('layoutTemplate', e.target.value)}>
                  <option value="midterm-standard">Midterm Standard (A4 Flat)</option>
                  <option value="annual-standard">Annual Standard (Consolidated)</option>
                </select>
              </div>

              <h5 style={{ fontWeight: 600, marginTop: '2rem', marginBottom: '1rem', color: '#475569' }}>Content Settings</h5>
              
              <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Report Card Title</label>
                  <input type="text" className="input-field" value={formData.settings.title} onChange={e => updateSetting('title', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
                  <input type="text" className="input-field" value={formData.settings.academicYear} onChange={e => updateSetting('academicYear', e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="block text-sm font-medium text-slate-700 mb-1">Promotion Rule Text (if applicable)</label>
                <input type="text" className="input-field" value={formData.settings.promotionRuleText} onChange={e => updateSetting('promotionRuleText', e.target.value)} />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Logo URL</label>
                <input type="text" className="input-field" value={formData.settings.logoUrl} onChange={e => updateSetting('logoUrl', e.target.value)} placeholder="https://..." />
              </div>
            </div>

            {/* Toggles and Print Settings */}
            <div>
              <h5 style={{ fontWeight: 600, marginBottom: '1rem', color: '#475569' }}>Feature Toggles</h5>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { key: 'showAttendance', label: 'Show Attendance' },
                  { key: 'showRemarks', label: 'Show Remarks' },
                  { key: 'showRank', label: 'Show Rank' },
                  { key: 'showPercentage', label: 'Show Percentage' },
                  { key: 'showQrCode', label: 'Show QR Code' }
                ].map(toggle => (
                  <label key={toggle.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.settings[toggle.key]} 
                      onChange={e => updateSetting(toggle.key, e.target.checked)} 
                    />
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{toggle.label}</span>
                  </label>
                ))}
              </div>

              <h5 style={{ fontWeight: 600, marginBottom: '1rem', color: '#475569' }}>Print Margins</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Top Margin (e.g. 10mm)</label>
                  <input type="text" className="input-field" value={formData.settings.margins.top} onChange={e => updateMargin('top', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Bottom Margin</label>
                  <input type="text" className="input-field" value={formData.settings.margins.bottom} onChange={e => updateMargin('bottom', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Left Margin</label>
                  <input type="text" className="input-field" value={formData.settings.margins.left} onChange={e => updateMargin('left', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Right Margin</label>
                  <input type="text" className="input-field" value={formData.settings.margins.right} onChange={e => updateMargin('right', e.target.value)} />
                </div>
              </div>
              
              <h5 style={{ fontWeight: 600, marginBottom: '1rem', color: '#475569' }}>Signatures</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Class Teacher Signature URL (Base64/Link)</label>
                  <input type="text" className="input-field" value={formData.settings.classTeacherSignatureUrl} onChange={e => updateSetting('classTeacherSignatureUrl', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Principal Signature URL (Base64/Link)</label>
                  <input type="text" className="input-field" value={formData.settings.principalSignatureUrl} onChange={e => updateSetting('principalSignatureUrl', e.target.value)} />
                </div>
              </div>
              
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {templates.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '2px dashed #cbd5e1', color: '#64748b' }}>
              <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <p>No report templates created yet.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Click "Create Template" to get started.</p>
            </div>
          ) : (
            templates.map(template => (
              <div key={template.id} style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{template.name}</h4>
                    {template.is_active && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: '#dcfce7', color: '#16a34a', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <CheckCircle size={12} /> Active
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Type:</strong> <span>{template.type}</span>
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Layout:</strong> <span>{template.settings?.layoutTemplate || 'Default'}</span>
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Year:</strong> <span>{template.settings?.academicYear || '-'}</span>
                    </span>
                  </div>
                </div>
                <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                  <button onClick={() => handleDelete(template.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', color: '#ef4444', background: 'transparent', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600 }}>
                    <Trash2 size={16} /> Delete
                  </button>
                  <button onClick={() => handleEdit(template)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', color: '#3b82f6', background: 'white', border: '1px solid #bfdbfe', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600 }}>
                    <Edit2 size={16} /> Edit Settings
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ReportCardCMS;
