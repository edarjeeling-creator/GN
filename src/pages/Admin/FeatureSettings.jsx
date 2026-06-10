import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { CheckCircle, Clock, AlertTriangle, Trash2, Plus, Search, X } from 'lucide-react';

const AddAccessModal = ({ isOpen, onClose, type, items, onGrant }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [actionType, setActionType] = useState('grant'); // 'grant' or 'block'
  const [accessType, setAccessType] = useState('permanent'); // 'permanent' or 'temporary'
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    if (type === 'class') return item.name.toLowerCase().includes(searchLower);
    if (type === 'teacher') return item.name.toLowerCase().includes(searchLower) || (item.email && item.email.toLowerCase().includes(searchLower));
    if (type === 'student') return item.name.toLowerCase().includes(searchLower) || (item.uid && item.uid.toLowerCase().includes(searchLower));
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedId) return;
    let finalExpiresAt = null;
    if (accessType === 'temporary' && expiresAt) {
      finalExpiresAt = new Date(expiresAt).toISOString();
    }
    const isEnabled = actionType === 'grant';
    onGrant(type, selectedId, isEnabled, finalExpiresAt, reason);
    setSearch('');
    setSelectedId('');
    setActionType('grant');
    setAccessType('permanent');
    setExpiresAt('');
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg capitalize">Add {type} Access</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 flex-1 overflow-y-auto">
          {/* Search & Select */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Select {type}</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder={`Search ${type}s...`}
                className="input-field pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="input-field" 
              value={selectedId} 
              onChange={e => setSelectedId(e.target.value)}
              required
              size={5}
            >
              {filteredItems.length === 0 && <option disabled>No matches found.</option>}
              {filteredItems.map(item => (
                <option key={item.id} value={item.id}>
                  {type === 'class' ? item.name : `${item.name} ${item.uid ? `(${item.uid})` : ''}`}
                </option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-green-700 font-medium">
                <input type="radio" checked={actionType === 'grant'} onChange={() => setActionType('grant')} />
                Grant Access
              </label>
              <label className="flex items-center gap-2 text-red-700 font-medium">
                <input type="radio" checked={actionType === 'block'} onChange={() => setActionType('block')} />
                Explicitly Block
              </label>
            </div>
          </div>

          {/* Access Type */}
          {actionType === 'grant' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={accessType === 'permanent'} onChange={() => setAccessType('permanent')} />
                  <span className="text-sm">Permanent</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={accessType === 'temporary'} onChange={() => setAccessType('temporary')} />
                  <span className="text-sm">Temporary (Set Expiry)</span>
                </label>
              </div>
            </div>
          )}

          {actionType === 'grant' && accessType === 'temporary' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Expires At</label>
              <input 
                type="datetime-local" 
                className="input-field" 
                value={expiresAt} 
                onChange={e => setExpiresAt(e.target.value)} 
                required 
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. Science Fair Project"
              className="input-field" 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className={actionType === 'grant' ? "btn-primary" : "btn-primary bg-red-600 hover:bg-red-700 ring-red-200"} disabled={!selectedId}>
              {actionType === 'grant' ? 'Grant Access' : 'Block Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FeatureSettings = ({ teachers }) => {
  const { classes, students, featureAccess, grantFeatureAccess, revokeFeatureAccess } = useData();
  const [modalState, setModalState] = useState({ isOpen: false, type: 'class', items: [] });

  const getActiveRules = (userType) => {
    if (!featureAccess || !Array.isArray(featureAccess)) return [];
    return featureAccess.filter(f => f.feature_name === 'python_portal' && f.user_type === userType);
  };

  const isRuleActive = (rule) => {
    if (!rule || !rule.is_enabled) return false;
    if (!rule.expires_at) return true;
    return new Date() < new Date(rule.expires_at);
  };

  const isRuleExpiringSoon = (rule) => {
    if (!rule || !rule.is_enabled || !rule.expires_at) return false;
    const expDate = new Date(rule.expires_at);
    const now = new Date();
    const daysLeft = (expDate - now) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 7;
  };

  let totalActive = 0;
  let totalExpired = 0;
  let totalExpiringSoon = 0;

  if (featureAccess && Array.isArray(featureAccess)) {
    featureAccess.forEach(rule => {
      if (rule.feature_name === 'python_portal' && rule.is_enabled) {
        if (isRuleActive(rule)) {
          totalActive++;
          if (isRuleExpiringSoon(rule)) totalExpiringSoon++;
        } else {
          totalExpired++;
        }
      }
    });
  }

  const handleGrant = (type, id, isEnabled, expiresAt, reason) => {
    grantFeatureAccess('python_portal', type, id, isEnabled, expiresAt, reason);
  };

  const handleRevoke = (type, id) => {
    if (window.confirm(`Are you sure you want to revoke this ${type}'s access?`)) {
      revokeFeatureAccess('python_portal', type, id);
    }
  };

  const openModal = (type) => {
    let items = [];
    if (type === 'class') items = classes;
    if (type === 'teacher') items = teachers;
    if (type === 'student') items = students;
    setModalState({ isOpen: true, type, items });
  };

  const renderActiveList = (title, type, rules) => {
    return (
      <div className="card p-6 bg-white border border-slate-200 rounded-xl flex flex-col h-[500px]">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {title}
          </h3>
          <button onClick={() => openModal(type)} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
            <Plus size={16} /> Add
          </button>
        </div>
        
        <div className="flex flex-col gap-2 overflow-y-auto pr-2 flex-1">
          {rules.length === 0 && (
            <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-sm text-slate-500">No active {type} access rules.</p>
            </div>
          )}
          
          {rules.map(rule => {
            let entityName = 'Unknown';
            let entitySub = '';
            let entityId = null;

            if (type === 'class') {
              const c = classes.find(c => c.id === rule.class_id);
              if (c) entityName = c.name;
              entityId = rule.class_id;
            } else if (type === 'teacher') {
              const t = teachers.find(t => t.id === rule.user_id);
              if (t) { entityName = t.name; entitySub = t.email; }
              entityId = rule.user_id;
            } else if (type === 'student') {
              const s = students.find(s => s.id === rule.student_id);
              if (s) { entityName = s.name; entitySub = s.uid || ''; }
              entityId = rule.student_id;
            }

            const active = isRuleActive(rule);
            const isExpired = !active;

            return (
              <div key={rule.id || entityId} className={`flex justify-between items-center p-3 border rounded-lg ${isExpired ? 'bg-red-50 border-red-100' : 'hover:bg-slate-50'}`}>
                <div>
                  <strong className="block text-slate-700">{entityName}</strong>
                  {entitySub && <span className="text-xs text-slate-400">{entitySub}</span>}
                  
                  {rule.is_enabled ? (
                    rule.expires_at ? (
                      <span className={`block text-[10px] mt-1 ${isExpired ? 'text-red-500 font-bold' : 'text-amber-600'}`}>
                        {isExpired ? 'Expired:' : 'Expires:'} {new Date(rule.expires_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="block text-[10px] mt-1 text-green-600">Permanent Access</span>
                    )
                  ) : (
                    <span className="block text-[10px] mt-1 text-red-600 font-bold">Explicitly Blocked</span>
                  )}
                  {rule.access_reason && <span className="block text-[10px] text-slate-400 italic">"{rule.access_reason}"</span>}
                </div>
                <button 
                  onClick={() => handleRevoke(type, entityId)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Revoke Access"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const classRules = getActiveRules('class');
  const studentRules = getActiveRules('student');
  const teacherRules = getActiveRules('teacher');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal Access Settings</h2>
        <p className="text-slate-500 mb-6">Exception-Based Management: Manage which teachers, classes, and individual students have explicitly been granted access. Priority: Student Exception &gt; Teacher &gt; Class.</p>

        {/* Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4">
             <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle /></div>
             <div>
               <p className="text-sm text-green-700 font-semibold">Active Assignments</p>
               <h4 className="text-2xl font-bold text-green-800">{totalActive}</h4>
             </div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4">
             <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Clock /></div>
             <div>
               <p className="text-sm text-amber-700 font-semibold">Expiring in &lt; 7 Days</p>
               <h4 className="text-2xl font-bold text-amber-800">{totalExpiringSoon}</h4>
             </div>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-4">
             <div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertTriangle /></div>
             <div>
               <p className="text-sm text-red-700 font-semibold">Expired Assignments</p>
               <h4 className="text-2xl font-bold text-red-800">{totalExpired}</h4>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {renderActiveList('🏫 Classes With Access', 'class', classRules)}
          {renderActiveList('🎓 Student Exceptions', 'student', studentRules)}
          {renderActiveList('👨‍🏫 Teachers With Access', 'teacher', teacherRules)}
        </div>
      </div>

      <AddAccessModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        type={modalState.type}
        items={modalState.items}
        onGrant={handleGrant}
      />
    </div>
  );
};

export default FeatureSettings;
