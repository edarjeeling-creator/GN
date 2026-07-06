import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, RefreshCw } from 'lucide-react';

const FeeConfigurator = () => {
  const [activeSubTab, setActiveSubTab] = useState('heads');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Fee Configuration Engine</h2>
          <p style={{ color: '#64748b' }}>Manage master fee categories, structures, and global rules.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveSubTab('heads')}
          style={{
            padding: '0.75rem 0',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'heads' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeSubTab === 'heads' ? '#2563eb' : '#64748b',
            fontWeight: activeSubTab === 'heads' ? '700' : '500',
            cursor: 'pointer',
            marginRight: '1rem'
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
            color: activeSubTab === 'structures' ? '#2563eb' : '#64748b',
            fontWeight: activeSubTab === 'structures' ? '700' : '500',
            cursor: 'pointer',
            marginRight: '1rem'
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
            color: activeSubTab === 'settings' ? '#2563eb' : '#64748b',
            fontWeight: activeSubTab === 'settings' ? '700' : '500',
            cursor: 'pointer'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Master Fee Heads</h3>
        <button onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Add Fee Head
        </button>
      </div>

      {isAdding && (
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Head Name</label>
            <input type="text" value={newHead.name} onChange={e => setNewHead({...newHead, name: e.target.value})} placeholder="e.g. Tuition Fee" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
            <input type="text" value={newHead.description} onChange={e => setNewHead({...newHead, description: e.target.value})} placeholder="Optional description" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={newHead.is_recurring} onChange={e => setNewHead({...newHead, is_recurring: e.target.checked})} />
              Monthly Recurring?
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button onClick={handleSave} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}><Save size={18} /></button>
            <button onClick={() => setIsAdding(false)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}><RefreshCw size={24} className="spin" /> Loading...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Fee Head Name</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Description</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {heads.map(head => (
              <tr key={head.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{head.name}</td>
                <td style={{ padding: '1rem', color: '#64748b' }}>{head.description || '-'}</td>
                <td style={{ padding: '1rem' }}>
                  {head.is_recurring ? 
                    <span style={{ background: '#dbeafe', color: '#2563eb', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>Monthly</span> : 
                    <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>One-Time / Annual</span>
                  }
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(head.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Class-wise Fee Structures</h3>
        <button onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Map Fee to Class
        </button>
      </div>

      {isAdding && (
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Class</label>
            <select value={newStructure.class_id} onChange={e => setNewStructure({...newStructure, class_id: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1' }}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Fee Head</label>
            <select value={newStructure.fee_head_id} onChange={e => setNewStructure({...newStructure, fee_head_id: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1' }}>
              <option value="">Select Fee Head</option>
              {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Amount (₹)</label>
            <input type="number" value={newStructure.amount} onChange={e => setNewStructure({...newStructure, amount: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSave} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}><Save size={18} /></button>
            <button onClick={() => setIsAdding(false)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Class</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Fee Head</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Amount</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {structures.map(struct => (
              <tr key={struct.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{struct.classes?.name} {struct.classes?.section}</td>
                <td style={{ padding: '1rem' }}>{struct.fee_heads?.name}</td>
                <td style={{ padding: '1rem', fontWeight: 700, color: '#059669' }}>₹{struct.amount}</td>
                <td style={{ padding: '1rem' }}>
                  {struct.fee_heads?.is_recurring ? 'Monthly' : 'Annual'}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(struct.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Bank & Payment Settings</h3>
      
      {loading ? (
        <div style={{ color: '#64748b' }}>Loading settings...</div>
      ) : (
        <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', maxWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>School Account Name</label>
              <input type="text" value={bankDetails.accountName} onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})} placeholder="e.g. Gyanoday Niketan" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Bank Name</label>
              <input type="text" value={bankDetails.bankName} onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} placeholder="e.g. State Bank of India" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Account Number</label>
              <input type="text" value={bankDetails.accountNo} onChange={e => setBankDetails({...bankDetails, accountNo: e.target.value})} placeholder="e.g. 31245678901" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>IFSC Code</label>
              <input type="text" value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value})} placeholder="e.g. SBIN0001234" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Official UPI ID (For QR Generation)</label>
              <input type="text" value={bankDetails.upiId} onChange={e => setBankDetails({...bankDetails, upiId: e.target.value})} placeholder="e.g. schoolname@sbi" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ width: '100%', background: '#2563eb', color: 'white', padding: '1rem', borderRadius: '0.5rem', fontWeight: 700, border: 'none', marginTop: '2rem', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Bank Details'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FeeConfigurator;
