import React from 'react';
import { useData } from '../../context/DataContext';
import { CheckCircle, XCircle } from 'lucide-react';

const FeatureSettings = ({ teachers }) => {
  const { classes, featureAccess, toggleFeatureAccess } = useData();

  const getFeatureState = (featureName, userType, id) => {
    if (!featureAccess || !Array.isArray(featureAccess)) return false;
    const rule = featureAccess.find(f => 
      f.feature_name === featureName && 
      f.user_type === userType && 
      (userType === 'teacher' ? f.user_id === id : f.class_id === id)
    );
    return rule ? rule.is_enabled : false;
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal Access Settings</h2>
        <p className="text-slate-500 mb-6">Manage which teachers and classes have access to specific portals and features.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Teacher Access */}
          <div className="card p-6 bg-white border border-slate-200 rounded-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">👨‍🏫</span> Teacher Access
            </h3>
            <p className="text-sm text-slate-500 mb-4">Enable the Python Portal for specific teachers.</p>
            
            <div className="flex flex-col gap-2">
              {teachers.map(teacher => {
                const isEnabled = getFeatureState('python_portal', 'teacher', teacher.id);
                return (
                  <div key={teacher.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                    <div>
                      <strong className="block text-slate-700">{teacher.name}</strong>
                      <span className="text-xs text-slate-400">{teacher.email}</span>
                    </div>
                    <button 
                      onClick={() => toggleFeatureAccess('python_portal', 'teacher', teacher.id, isEnabled)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {isEnabled ? <><CheckCircle size={16} /> Enabled</> : <><XCircle size={16} /> Disabled</>}
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
            <p className="text-sm text-slate-500 mb-4">Enable the Python Portal for students in specific classes.</p>
            
            <div className="flex flex-col gap-2">
              {classes.map(cls => {
                const isEnabled = getFeatureState('python_portal', 'class', cls.id);
                return (
                  <div key={cls.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                    <strong className="block text-slate-700">{cls.name} {cls.section}</strong>
                    <button 
                      onClick={() => toggleFeatureAccess('python_portal', 'class', cls.id, isEnabled)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {isEnabled ? <><CheckCircle size={16} /> Enabled</> : <><XCircle size={16} /> Disabled</>}
                    </button>
                  </div>
                );
              })}
              {classes.length === 0 && <p className="text-sm text-slate-400">No classes found.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureSettings;
