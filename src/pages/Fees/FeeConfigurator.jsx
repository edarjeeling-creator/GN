import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, RefreshCw } from 'lucide-react';

const FeeConfigurator = () => {
  const [activeSubTab, setActiveSubTab] = useState('heads');

  return (
    <div style={{ color: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Fee Configuration Engine</h2>
          <p style={{ color: '#475569', marginTop: '0.25rem' }}>Manage master fee categories, structures, and global rules.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #cbd5e1', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveSubTab('heads')}
          style={{
            padding: '0.75rem 0',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'heads' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeSubTab === 'heads' ? '#2563eb' : '#475569',
            fontWeight: activeSubTab === 'heads' ? '700' : '600',
            cursor: 'pointer',
            marginRight: '1rem',
            fontSize: '0.95rem'
          }}
        >
          Fee Heads (Master)
        </button>
        <button
          onClick={() => setActiveSubTab('structures')}
          style={{
            padding: '0.75rem 0',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'structures' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeSubTab === 'structures' ? '#2563eb' : '#475569',
            fontWeight: activeSubTab === 'structures' ? '700' : '600',
            cursor: 'pointer',
            marginRight: '1rem',
            fontSize: '0.95rem'
          }}
        >
          Class Fee Structures
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          style={{
            padding: '0.75rem 0',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'settings' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeSubTab === 'settings' ? '#2563eb' : '#475569',
            fontWeight: activeSubTab === 'settings' ? '700' : '600',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Global Settings & Rules
        </button>
      </div>

      {activeSubTab === 'heads' && <FeeHeadsManager />}
      {activeSubTab === 'structures' && <FeeStructuresManager />}
      {activeSubTab === 'settings' && <FeeSettingsManager />}
    </div>
  );
};

const FeeHeadsManager = () => {
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newHead, setNewHead] = useState({ name: '', description: '', is_recurring: true });

  useEffect(() => {
    fetchHeads();
  }, []);

  const fetchHeads = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fee_heads').select('*').order('created_at', { ascending: true });
    if (data) setHeads(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!newHead.name.trim()) return alert("Name is required");
    const { error } = await supabase.from('fee_heads').insert([newHead]);
    if (error) {
      alert("Error adding fee head: " + error.message);
    } else {
      setIsAdding(false);
      setNewHead({ name: '', description: '', is_recurring: true });
      fetchHeads();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this fee head? This may break existing structures!")) return;
    const { error } = await supabase.from('fee_heads').delete().eq('id', id);
    if (error) alert("Cannot delete. It may be in use.");
    else fetchHeads();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Master Fee Heads</h3>
        <button onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: '#ffffff', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Add Fee Head
        </button>
      </div>

      {isAdding && (
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Head Name</label>
            <input type="text" value={newHead.name} onChange={e => setNewHead({...newHead, name: e.target.value})} placeholder="e.g. Tuition Fee" style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Description</label>
            <input type="text" value={newHead.description} onChange={e => setNewHead({...newHead, description: e.target.value})} placeholder="Optional description" style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
              <input type="checkbox" checked={newHead.is_recurring} onChange={e => setNewHead({...newHead, is_recurring: e.target.checked})} />
              Monthly Recurring?
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={handleSave} style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}><Save size={16} /> Save</button>
            <button onClick={() => setIsAdding(false)} style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}><X size={16} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#475569' }}><RefreshCw size={24} className="spin" /> Loading...</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f1f5f9' }}>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Fee Head Name</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Description</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Type</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {heads.map(head => (
                <tr key={head.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#0f172a', fontSize: '0.925rem' }}>{head.name}</td>
                  <td style={{ padding: '1rem', color: '#334155', fontSize: '0.9rem' }}>{head.description || '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    {head.is_recurring ? 
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>Monthly</span> : 
                      <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>One-Time / Annual</span>
                    }
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(head.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {heads.length === 0 && !isAdding && (
                <tr>
                  <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No fee heads configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const FeeStructuresManager = () => {
  const [structures, setStructures] = useState([]);
  const [heads, setHeads] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newStructure, setNewStructure] = useState({ class_id: '', fee_head_id: '', amount: '', academic_year: '2026' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [structRes, headsRes, classRes] = await Promise.all([
      supabase.from('fee_structures').select('*, fee_heads(name, is_recurring), classes(name, section)'),
      supabase.from('fee_heads').select('*'),
      supabase.from('classes').select('*').order('name', { ascending: true })
    ]);
    if (structRes.data) setStructures(structRes.data);
    if (headsRes.data) setHeads(headsRes.data);
    if (classRes.data) setClasses(classRes.data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!newStructure.class_id || !newStructure.fee_head_id || !newStructure.amount) return alert("All fields required");
    const { error } = await supabase.from('fee_structures').insert([newStructure]);
    if (error) alert("Error saving structure: " + error.message);
    else {
      setIsAdding(false);
      setNewStructure({ ...newStructure, fee_head_id: '', amount: '' });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this fee structure rule?")) return;
    await supabase.from('fee_structures').delete().eq('id', id);
    fetchData();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Class-wise Fee Structures</h3>
        <button onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: '#ffffff', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Map Fee to Class
        </button>
      </div>

      {isAdding && (
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Class</label>
            <select value={newStructure.class_id} onChange={e => setNewStructure({...newStructure, class_id: e.target.value})} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Fee Head</label>
            <select value={newStructure.fee_head_id} onChange={e => setNewStructure({...newStructure, fee_head_id: e.target.value})} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }}>
              <option value="">Select Fee Head</option>
              {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Amount (₹)</label>
            <input type="number" value={newStructure.amount} onChange={e => setNewStructure({...newStructure, amount: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSave} style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}><Save size={16} /> Save</button>
            <button onClick={() => setIsAdding(false)} style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}><X size={16} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#475569' }}>Loading...</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f1f5f9' }}>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Class</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Fee Head</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Amount</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>Type</th>
                <th style={{ padding: '0.875rem 1rem', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {structures.map(struct => (
                <tr key={struct.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#0f172a', fontSize: '0.925rem' }}>{struct.classes?.name} {struct.classes?.section}</td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{struct.fee_heads?.name}</td>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#059669', fontSize: '0.95rem' }}>₹{Number(struct.amount).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '1rem' }}>
                    {struct.fee_heads?.is_recurring ? 
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>Monthly</span> : 
                      <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>Annual</span>
                    }
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(struct.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {structures.length === 0 && !isAdding && (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No fee structures mapped yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const FeeSettingsManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    bankName: '',
    accountNo: '',
    ifscCode: '',
    upiId: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fee_settings')
      .select('value')
      .eq('key', 'school_bank_details')
      .single();
    
    if (data?.value) {
      setBankDetails(data.value);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('fee_settings')
      .upsert({ key: 'school_bank_details', value: bankDetails }, { onConflict: 'key' });
    
    if (error) alert("Failed to save: " + error.message);
    else alert("Bank details updated successfully!");
    setSaving(false);
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>Bank & Payment Settings</h3>
      
      {loading ? (
        <div style={{ color: '#475569' }}>Loading settings...</div>
      ) : (
        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '1rem', border: '1px solid #cbd5e1', maxWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>School Account Name</label>
              <input type="text" value={bankDetails.accountName} onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})} placeholder="e.g. Gyanoday Niketan" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Bank Name</label>
              <input type="text" value={bankDetails.bankName} onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} placeholder="e.g. State Bank of India" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Account Number</label>
              <input type="text" value={bankDetails.accountNo} onChange={e => setBankDetails({...bankDetails, accountNo: e.target.value})} placeholder="e.g. 31245678901" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>IFSC Code</label>
              <input type="text" value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value})} placeholder="e.g. SBIN0001234" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Official UPI ID (For QR Generation)</label>
              <input type="text" value={bankDetails.upiId} onChange={e => setBankDetails({...bankDetails, upiId: e.target.value})} placeholder="e.g. schoolname@sbi" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.9rem' }} />
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ width: '100%', background: '#2563eb', color: '#ffffff', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontWeight: 700, border: 'none', marginTop: '1.75rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}
          >
            {saving ? 'Saving...' : 'Save Bank Details'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FeeConfigurator;
