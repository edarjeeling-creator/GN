import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { MarksWorkflowService } from '../../services/MarksWorkflowService';
import { 
  Settings2, Plus, Edit2, Check, X, Trash2, 
  Layers, ShieldAlert, Award, Sliders, AlertCircle, Copy
} from 'lucide-react';

export default function AcademicAssessmentConfig() {
  const { profile } = useAuth();
  const { classes, subjects, academicYear } = useData();

  const [patterns, setPatterns] = useState([]);
  const [selectedPatternId, setSelectedPatternId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [activeTab, setActiveTab] = useState('components'); // 'components', 'grades', 'subject_rules'

  // Modal State for New Pattern
  const [showNewPatternModal, setShowNewPatternModal] = useState(false);
  const [newPatternForm, setNewPatternForm] = useState({
    pattern_name: '',
    class_group: 'CUSTOM',
    applicable_classes: [],
    description: '',
    academic_year: academicYear || '2026',
    rounding_rule: 'ROUND_2_DECIMALS'
  });

  // Modal State for New Component
  const [showNewComponentModal, setShowNewComponentModal] = useState(false);
  const [newComponentForm, setNewComponentForm] = useState({
    component_code: '',
    component_name: '',
    raw_max_marks: 100,
    converted_max_marks: 100,
    weightage_percentage: 100,
    is_mandatory: true,
    contributes_to_total: true
  });

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const data = await MarksWorkflowService.getAssessmentPatterns(academicYear);
      setPatterns(data);
      if (data.length > 0 && !selectedPatternId) {
        setSelectedPatternId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching assessment patterns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, [academicYear]);

  const currentPattern = patterns.find(p => p.id === selectedPatternId);

  // Create Pattern
  const handleCreatePattern = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('assessment_patterns')
        .insert([{
          ...newPatternForm,
          applicable_classes: newPatternForm.applicable_classes,
          version: 1,
          status: 'ACTIVE',
          created_by: profile?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setShowNewPatternModal(false);
      setNewPatternForm({
        pattern_name: '',
        class_group: 'CUSTOM',
        applicable_classes: [],
        description: '',
        academic_year: academicYear || '2026',
        rounding_rule: 'ROUND_2_DECIMALS'
      });
      await loadPatterns();
      setSelectedPatternId(data.id);
      setSaveStatus('Assessment scheme successfully created!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      alert('Error creating pattern: ' + err.message);
    }
  };

  // Add Component to current pattern
  const handleAddComponent = async (e) => {
    e.preventDefault();
    if (!selectedPatternId) return;

    try {
      const { error } = await supabase
        .from('assessment_components')
        .insert([{
          pattern_id: selectedPatternId,
          component_code: newComponentForm.component_code.toUpperCase().replace(/\s+/g, '_'),
          component_name: newComponentForm.component_name,
          raw_max_marks: Number(newComponentForm.raw_max_marks),
          converted_max_marks: Number(newComponentForm.converted_max_marks),
          weightage_percentage: Number(newComponentForm.weightage_percentage),
          is_mandatory: newComponentForm.is_mandatory,
          contributes_to_total: newComponentForm.contributes_to_total,
          calculation_rule: { formula: 'RAW * CONVERTED_MAX / RAW_MAX' }
        }]);

      if (error) throw error;

      setShowNewComponentModal(false);
      setNewComponentForm({
        component_code: '',
        component_name: '',
        raw_max_marks: 100,
        converted_max_marks: 100,
        weightage_percentage: 100,
        is_mandatory: true,
        contributes_to_total: true
      });
      await loadPatterns();
      setSaveStatus('Component successfully added to scheme!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      alert('Error adding component: ' + err.message);
    }
  };

  // Clone Pattern to Next Version
  const handleCloneNewVersion = async () => {
    if (!currentPattern) return;
    const confirmClone = window.confirm(
      `Create Version ${currentPattern.version + 1} for "${currentPattern.pattern_name}"?\nHistorical reports will stay locked to Version ${currentPattern.version}.`
    );
    if (!confirmClone) return;

    try {
      // 1. Insert new pattern
      const { data: newPat, error: pErr } = await supabase
        .from('assessment_patterns')
        .insert([{
          academic_year: currentPattern.academic_year,
          pattern_name: currentPattern.pattern_name,
          class_group: currentPattern.class_group,
          applicable_classes: currentPattern.applicable_classes,
          description: currentPattern.description,
          version: currentPattern.version + 1,
          status: 'ACTIVE',
          rounding_rule: currentPattern.rounding_rule,
          created_by: profile?.id
        }])
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Clone components
      if (currentPattern.components?.length > 0) {
        const compsToInsert = currentPattern.components.map(c => ({
          pattern_id: newPat.id,
          component_code: c.component_code,
          component_name: c.component_name,
          raw_max_marks: c.raw_max_marks,
          converted_max_marks: c.converted_max_marks,
          weightage_percentage: c.weightage_percentage,
          is_mandatory: c.is_mandatory,
          contributes_to_total: c.contributes_to_total,
          display_order: c.display_order,
          calculation_rule: c.calculation_rule
        }));
        await supabase.from('assessment_components').insert(compsToInsert);
      }

      // 3. Clone grade boundaries
      if (currentPattern.grade_boundaries?.length > 0) {
        const gradesToInsert = currentPattern.grade_boundaries.map(g => ({
          pattern_id: newPat.id,
          grade_name: g.grade_name,
          min_percentage: g.min_percentage,
          max_percentage: g.max_percentage,
          grade_point: g.grade_point,
          description: g.description
        }));
        await supabase.from('grade_boundaries').insert(gradesToInsert);
      }

      // 4. Archive old pattern version
      await supabase
        .from('assessment_patterns')
        .update({ status: 'ARCHIVED' })
        .eq('id', currentPattern.id);

      await loadPatterns();
      setSelectedPatternId(newPat.id);
      setSaveStatus(`Version ${newPat.version} created and activated!`);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      alert('Error versioning pattern: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider">
            <Settings2 size={16} />
            <span>Admin-Configurable Assessment Architecture</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Academic Assessment Schemes & Conversions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure dynamic evaluation patterns, exam conversion ratios, grade boundaries, and 6th-subject rules without code changes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewPatternModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <Plus size={16} />
            <span>New Assessment Scheme</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold flex items-center gap-2">
          <Check size={18} />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Grid: Patterns Sidebar + Configuration Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Schemes List Sidebar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
            Active School Schemes
          </div>

          <div className="space-y-2">
            {patterns.map(pat => {
              const isSelected = pat.id === selectedPatternId;
              return (
                <div
                  key={pat.id}
                  onClick={() => setSelectedPatternId(pat.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-700 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200/80 dark:bg-slate-900/40 dark:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {pat.pattern_name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      v{pat.version}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                    <span>{pat.class_group}</span>
                    <span className={`font-semibold ${pat.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {pat.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration Workspace */}
        <div className="lg:col-span-3 space-y-5">
          {currentPattern ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
              {/* Pattern Info Card */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {currentPattern.pattern_name}
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                      Version {currentPattern.version}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      {currentPattern.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Applicable to: <strong>{Array.isArray(currentPattern.applicable_classes) ? currentPattern.applicable_classes.join(', ') : 'All Assigned'}</strong> • 
                    Rounding: <strong>{currentPattern.rounding_rule}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCloneNewVersion}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                    title="Clone to new version for future terms"
                  >
                    <Copy size={14} />
                    <span>Create New Version</span>
                  </button>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                <button
                  onClick={() => setActiveTab('components')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'components'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Assessment Components ({currentPattern.components?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('grades')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'grades'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Grade Boundaries ({currentPattern.grade_boundaries?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('subject_rules')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'subject_rules'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Subject Specific Rules ({currentPattern.subject_rules?.length || 0})
                </button>
              </div>

              {/* TAB 1: Components */}
              {activeTab === 'components' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Evaluation Components & Automatic Conversions
                    </span>
                    <button
                      onClick={() => setShowNewComponentModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 dark:text-indigo-300"
                    >
                      <Plus size={14} /> Add Component
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Component Name</th>
                          <th className="py-2.5 px-3 text-center">Raw Max</th>
                          <th className="py-2.5 px-3 text-center">Converted Max</th>
                          <th className="py-2.5 px-3 text-center">Weightage</th>
                          <th className="py-2.5 px-3 text-center">Totaling</th>
                          <th className="py-2.5 px-3 text-center">Mandatory</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {currentPattern.components?.map(comp => (
                          <tr key={comp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                            <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {comp.component_code}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                              {comp.component_name}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                              {comp.raw_max_marks}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                              {comp.converted_max_marks}
                            </td>
                            <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-300">
                              {comp.weightage_percentage}%
                            </td>
                            <td className="py-3 px-3 text-center">
                              {comp.contributes_to_total ? (
                                <span className="text-emerald-600 font-semibold">Included</span>
                              ) : (
                                <span className="text-slate-400">Excluded</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {comp.is_mandatory ? (
                                <span className="text-amber-600 font-semibold">Yes</span>
                              ) : (
                                <span className="text-slate-400">Optional</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Grades */}
              {activeTab === 'grades' && (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Grading Scale & Cutoffs
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {currentPattern.grade_boundaries?.map(grade => (
                      <div key={grade.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-center">
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{grade.grade_name}</div>
                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {grade.min_percentage}% – {grade.max_percentage}%
                        </div>
                        {grade.grade_point !== null && (
                          <div className="text-[11px] text-slate-400 mt-1">GP: {grade.grade_point}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Subject Rules */}
              {activeTab === 'subject_rules' && (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Subject Level Overrides & 6th Subject Rules
                  </div>
                  <p className="text-xs text-slate-500">
                    Define whether elective subjects or 6th subjects count toward overall aggregate percentage and rank.
                  </p>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Configured Rule Behavior:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Main Subjects: Included in aggregate, percentage, and rank.</li>
                      <li>Sixth Subject / Additional: Configurable inclusion based on board regulations (e.g. Best 5 rule).</li>
                      <li>Junior Graded Subjects: Excluded from percentage calculation, displayed as standalone letter grades.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              No assessment scheme selected.
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Scheme */}
      {showNewPatternModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">New Assessment Scheme</h3>
              <button onClick={() => setShowNewPatternModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePattern} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Scheme Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior School Classes 5-8"
                  value={newPatternForm.pattern_name}
                  onChange={e => setNewPatternForm({ ...newPatternForm, pattern_name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class Group *</label>
                  <select
                    value={newPatternForm.class_group}
                    onChange={e => setNewPatternForm({ ...newPatternForm, class_group: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="JUNIOR">Junior School</option>
                    <option value="SENIOR_5_8">Senior School 5–8</option>
                    <option value="SECONDARY_9_10">Secondary 9–10</option>
                    <option value="HIGHER_SECONDARY_11_12">Higher Secondary 11–12</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Rounding Rule *</label>
                  <select
                    value={newPatternForm.rounding_rule}
                    onChange={e => setNewPatternForm({ ...newPatternForm, rounding_rule: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="ROUND_2_DECIMALS">Round to 2 Decimals</option>
                    <option value="ROUND_1_DECIMAL">Round to 1 Decimal</option>
                    <option value="ROUND_NEAREST_INTEGER">Round to Nearest Integer</option>
                    <option value="NO_ROUNDING">No Rounding</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description / Guidelines</label>
                <textarea
                  rows={3}
                  value={newPatternForm.description}
                  onChange={e => setNewPatternForm({ ...newPatternForm, description: e.target.value })}
                  placeholder="e.g. Unit test 25 raw marks, exam 100 raw converted to 75..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPatternModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  Create Scheme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Component */}
      {showNewComponentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Add Component</h3>
              <button onClick={() => setShowNewComponentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddComponent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Component Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Term Examination"
                  value={newComponentForm.component_name}
                  onChange={e => setNewComponentForm({ ...newComponentForm, component_name: e.target.value, component_code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Raw Max Marks *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newComponentForm.raw_max_marks}
                    onChange={e => setNewComponentForm({ ...newComponentForm, raw_max_marks: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Converted Max Marks *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newComponentForm.converted_max_marks}
                    onChange={e => setNewComponentForm({ ...newComponentForm, converted_max_marks: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newComponentForm.contributes_to_total}
                    onChange={e => setNewComponentForm({ ...newComponentForm, contributes_to_total: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Include in Total</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newComponentForm.is_mandatory}
                    onChange={e => setNewComponentForm({ ...newComponentForm, is_mandatory: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Mandatory</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewComponentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  Add Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
