import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

const FeatureSettings = ({ teachers }) => {
  const { classes, students, featureAccess, toggleFeatureAccess } = useData();

  // State for adding new temporary access
  const [selectedExpiresAt, setSelectedExpiresAt] = useState('');
  const [accessReason, setAccessReason] = useState('');

  const getFeatureRule = (featureName, userType, id) => {
    if (!featureAccess || !Array.isArray(featureAccess)) return null;
    return featureAccess.find(f => 
      f.feature_name === featureName && 
      f.user_type === userType && 
      (userType === 'teacher' ? f.user_id === id : userType === 'student' ? f.student_id === id : f.class_id === id)
    );
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

  // Metrics
  let totalActive = 0;
  let totalExpired = 0;
  let totalExpiringSoon = 0;

  if (featureAccess && Array.isArray(featureAccess)) {
    featureAccess.forEach(rule => {
      if (rule.feature_name === 'python_portal') {
        if (!rule.is_enabled) return;
        
        const active = isRuleActive(rule);
        if (active) {
          totalActive++;
          if (isRuleExpiringSoon(rule)) totalExpiringSoon++;
        } else {
          totalExpired++;
        }
      }
    });
  }

  const handleToggle = (userType, id, currentRule) => {
    let expiresAt = null;
    if (!currentRule?.is_enabled && selectedExpiresAt) {
       // Convert local date string to ISO
       expiresAt = new Date(selectedExpiresAt).toISOString();
    }
    toggleFeatureAccess('python_portal', userType, id, currentRule?.is_enabled || false, expiresAt, accessReason);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal Access Settings</h2>
        <p className="text-slate-500 mb-6">Manage which teachers, classes, and individual students have access to specific portals. Priority: Student &gt; Class.</p>

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

        {/* Default Settings Form for New Assignments */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-8 flex flex-wrap gap-4 items-end">
           <div>
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Temporary Expiration (Optional)</label>
             <input type="datetime-local" className="input-field bg-white" value={selectedExpiresAt} onChange={e => setSelectedExpiresAt(e.target.value)} />
           </div>
           <div className="flex-1 min-w-[200px]">
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Access Reason (Optional)</label>
             <input type="text" placeholder="e.g. Approved for Summer Camp" className="input-field bg-white" value={accessReason} onChange={e => setAccessReason(e.target.value)} />
           </div>
           <p className="text-xs text-slate-400 w-full mt-2">These settings will apply to the next user or class you enable.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Teacher Access */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">👨‍🏫</span> Teacher Access
            </h3>
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
              {teachers.map(teacher => {
                const rule = getFeatureRule('python_portal', 'teacher', teacher.id);
                const isEnabled = isRuleActive(rule);
                const isExpired = rule?.is_enabled && !isEnabled;
                
                return (
                  <div key={teacher.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                    <div>
                      <strong className="block text-slate-700">{teacher.name}</strong>
                      <span className="text-xs text-slate-400">{teacher.email}</span>
                      {rule?.expires_at && <span className={`block text-[10px] mt-1 ${isExpired ? 'text-red-500 font-bold' : 'text-amber-600'}`}>{isExpired ? 'Expired' : 'Expires'}: {new Date(rule.expires_at).toLocaleDateString()}</span>}
                      {rule?.access_reason && <span className="block text-[10px] text-slate-400 italic">"{rule.access_reason}"</span>}
                    </div>
                    <button 
                      onClick={() => handleToggle('teacher', teacher.id, rule)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : isExpired ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {isEnabled ? <><CheckCircle size={14} /> Enabled</> : isExpired ? <><XCircle size={14} /> Expired</> : <><XCircle size={14} /> Disabled</>}
                    </button>
                  </div>
                );
              })}
              {teachers.length === 0 && <p className="text-sm text-slate-400">No teachers found.</p>}
            </div>
          </div>

          {/* Class Access */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎓</span> Class Access
            </h3>
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
              {classes.map(cls => {
                const rule = getFeatureRule('python_portal', 'class', cls.id);
                const isEnabled = isRuleActive(rule);
                const isExpired = rule?.is_enabled && !isEnabled;

                return (
                  <div key={cls.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                    <div>
                      <strong className="block text-slate-700">{cls.name} {cls.section}</strong>
                      {rule?.expires_at && <span className={`block text-[10px] mt-1 ${isExpired ? 'text-red-500 font-bold' : 'text-amber-600'}`}>{isExpired ? 'Expired' : 'Expires'}: {new Date(rule.expires_at).toLocaleDateString()}</span>}
                      {rule?.access_reason && <span className="block text-[10px] text-slate-400 italic">"{rule.access_reason}"</span>}
                    </div>
                    <button 
                      onClick={() => handleToggle('class', cls.id, rule)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : isExpired ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {isEnabled ? <><CheckCircle size={14} /> Enabled</> : isExpired ? <><XCircle size={14} /> Expired</> : <><XCircle size={14} /> Disabled</>}
                    </button>
                  </div>
                );
              })}
              {classes.length === 0 && <p className="text-sm text-slate-400">No classes found.</p>}
            </div>
          </div>

          {/* Student Specific Access */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎒</span> Student Exceptions
            </h3>
            <p className="text-xs text-slate-500 mb-4">Override class rules for specific students.</p>
            <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-2">
              {students.slice(0, 50).map(student => {
                const rule = getFeatureRule('python_portal', 'student', student.id);
                const classRule = getFeatureRule('python_portal', 'class', student.class_id);
                
                const isStudentRuleActive = isRuleActive(rule);
                const isClassRuleActive = isRuleActive(classRule);
                const isStudentExpired = rule?.is_enabled && !isStudentRuleActive;
                
                // Effective state
                const isEffectivelyEnabled = rule ? isStudentRuleActive : isClassRuleActive;

                return (
                  <div key={student.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                    <div>
                      <strong className="block text-slate-700 text-sm">{student.name}</strong>
                      <span className="text-[10px] text-slate-400">Class: {classes.find(c => c.id === student.class_id)?.name} {classes.find(c => c.id === student.class_id)?.section}</span>
                      
                      {rule?.expires_at && <span className={`block text-[10px] mt-1 ${isStudentExpired ? 'text-red-500 font-bold' : 'text-amber-600'}`}>{isStudentExpired ? 'Expired' : 'Expires'}: {new Date(rule.expires_at).toLocaleDateString()}</span>}
                      {rule?.access_reason && <span className="block text-[10px] text-slate-400 italic">"{rule.access_reason}"</span>}
                    </div>
                    <button 
                      onClick={() => handleToggle('student', student.id, rule)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors ${rule ? (isStudentRuleActive ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : isStudentExpired ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300') : (isClassRuleActive ? 'bg-green-50 text-green-600 opacity-70' : 'bg-slate-50 text-slate-400 opacity-70')}`}
                      title={rule ? "Explicit student rule" : "Inherited from class"}
                    >
                      {rule ? (isStudentRuleActive ? <><CheckCircle size={12} /> Override: ON</> : isStudentExpired ? <><XCircle size={12} /> Expired</> : <><XCircle size={12} /> Override: OFF</>) : (isClassRuleActive ? <><CheckCircle size={12} /> Inherited</> : <><XCircle size={12} /> Disabled</>)}
                    </button>
                  </div>
                );
              })}
              {students.length === 0 && <p className="text-sm text-slate-400">No students found.</p>}
            </div>
            {students.length > 50 && <p className="text-xs text-center text-slate-400 mt-2">Showing first 50 students. Use search to find others (coming soon).</p>}
          </div>

        </div>
      </div>
    </div>
  );
};

export default FeatureSettings;
