import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export default function HPCConfiguration() {
  const { profile, loading: authLoading } = useAuth();
  const { classes } = useData();
  const [activeTab, setActiveTab] = useState('academic_years');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [yearForm, setYearForm] = useState({ year_name: '', start_date: '', end_date: '' });
  const [termForm, setTermForm] = useState({ term_name: '', academic_year_id: '' });
  const [frameworkForm, setFrameworkForm] = useState({ name: '', description: '', academic_year_id: '', applicable_class_id: '' });
  const [domainForm, setDomainForm] = useState({ name: '', description: '', framework_id: '', display_order: 0 });
  const [competencyForm, setCompetencyForm] = useState({ name: '', category: 'Cognitive', description: '', domain_id: '' });
  const [indicatorForm, setIndicatorForm] = useState({ name: '', code: '', description: '', competency_id: '', display_order: 0 });
  const [scaleForm, setScaleForm] = useState({
    name: '3-Point Holistic Scale',
    description: 'Standard 3-level rating scale',
    framework_id: '',
    levels: [
      { level_name: 'Beginning', numeric_value: 1, color_code: '#EF4444', display_order: 1 },
      { level_name: 'Progressing', numeric_value: 2, color_code: '#F59E0B', display_order: 2 },
      { level_name: 'Proficient', numeric_value: 3, color_code: '#10B981', display_order: 3 }
    ]
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchData();
    }
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [
        { data: years },
        { data: terms },
        { data: competencies },
        { data: frameworks },
        { data: domains },
        { data: domainComps },
        { data: indicators },
        { data: scaleSets },
        { data: scaleLevels }
      ] = await Promise.all([
        supabase.from('hpc_academic_years').select('*').order('created_at', { ascending: false }),
        supabase.from('hpc_terms').select('*, hpc_academic_years(year_name)').order('term_name'),
        supabase.from('hpc_competencies').select('*').order('name'),
        supabase.from('hpc_frameworks').select('*, hpc_academic_years(year_name)').order('created_at', { ascending: false }),
        supabase.from('hpc_domains').select('*, hpc_frameworks(name)').order('display_order'),
        supabase.from('hpc_domain_competencies').select('*'),
        supabase.from('hpc_indicators').select('*, hpc_competencies(name)').order('display_order'),
        supabase.from('hpc_rating_scale_sets').select('*'),
        supabase.from('hpc_rating_scale_levels').select('*, hpc_rating_scale_sets(name)').order('display_order')
      ]);

      setData({
        academic_years: years || [],
        terms: terms || [],
        competencies: competencies || [],
        frameworks: frameworks || [],
        domains: domains || [],
        domain_competencies: domainComps || [],
        indicators: indicators || [],
        scale_sets: scaleSets || [],
        scale_levels: scaleLevels || []
      });

      // Default select values if available
      if (years?.length && !termForm.academic_year_id) {
        setTermForm(prev => ({ ...prev, academic_year_id: years[0].id }));
        setFrameworkForm(prev => ({ ...prev, academic_year_id: years[0].id }));
      }
      if (classes?.length && !frameworkForm.applicable_class_id) {
        setFrameworkForm(prev => ({ ...prev, applicable_class_id: classes[0].id }));
      }
      if (frameworks?.length && !domainForm.framework_id) {
        setDomainForm(prev => ({ ...prev, framework_id: frameworks[0].id }));
        setScaleForm(prev => ({ ...prev, framework_id: frameworks[0].id }));
      }
      if (competencies?.length && !indicatorForm.competency_id) {
        setIndicatorForm(prev => ({ ...prev, competency_id: competencies[0].id }));
      }
    } catch (error) {
      console.error('Error fetching HPC configuration:', error);
      setErrorMsg('Failed to load configuration: ' + error.message);
    }
    setLoading(false);
  }

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // 1. Create Academic Year
  async function handleCreateYear(e) {
    e.preventDefault();
    if (!yearForm.year_name.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    const { error } = await supabase.from('hpc_academic_years').insert([{
      year_name: yearForm.year_name.trim(),
      start_date: yearForm.start_date || null,
      end_date: yearForm.end_date || null,
      is_active: true
    }]);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Failed to save Academic Year: ' + error.message);
    } else {
      setYearForm({ year_name: '', start_date: '', end_date: '' });
      showNotification('Academic Year saved successfully!');
      fetchData();
    }
  }

  // 2. Create Term
  async function handleCreateTerm(e) {
    e.preventDefault();
    if (!termForm.term_name.trim() || !termForm.academic_year_id) return;
    setSubmitting(true);
    setErrorMsg('');
    const { error } = await supabase.from('hpc_terms').insert([{
      term_name: termForm.term_name.trim(),
      academic_year_id: termForm.academic_year_id,
      is_active: true
    }]);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Failed to save Term: ' + error.message);
    } else {
      setTermForm(prev => ({ ...prev, term_name: '' }));
      showNotification('Term saved successfully!');
      fetchData();
    }
  }

  // 3. Create Framework
  async function handleCreateFramework(e) {
    e.preventDefault();
    if (!frameworkForm.name.trim() || !frameworkForm.academic_year_id || !frameworkForm.applicable_class_id) return;
    setSubmitting(true);
    setErrorMsg('');
    const { error } = await supabase.from('hpc_frameworks').insert([{
      name: frameworkForm.name.trim(),
      description: frameworkForm.description.trim(),
      academic_year_id: frameworkForm.academic_year_id,
      applicable_class_id: frameworkForm.applicable_class_id,
      is_active: true
    }]);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Failed to save Framework: ' + error.message);
    } else {
      setFrameworkForm(prev => ({ ...prev, name: '', description: '' }));
      showNotification('Framework saved successfully!');
      fetchData();
    }
  }

  // 4. Create Domain
  async function handleCreateDomain(e) {
    e.preventDefault();
    if (!domainForm.name.trim() || !domainForm.framework_id) return;
    setSubmitting(true);
    setErrorMsg('');
    const { error } = await supabase.from('hpc_domains').insert([{
      name: domainForm.name.trim(),
      description: domainForm.description.trim(),
      framework_id: domainForm.framework_id,
      display_order: parseInt(domainForm.display_order, 10) || 0,
      is_active: true
    }]);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Failed to save Domain: ' + error.message);
    } else {
      setDomainForm(prev => ({ ...prev, name: '', description: '', display_order: prev.display_order + 1 }));
      showNotification('Domain saved successfully!');
      fetchData();
    }
  }

  // 5. Create Competency and map to Domain
  async function handleCreateCompetency(e) {
    e.preventDefault();
    if (!competencyForm.name.trim() || !competencyForm.category) return;
    setSubmitting(true);
    setErrorMsg('');
    const { data: comp, error: compErr } = await supabase.from('hpc_competencies').insert([{
      name: competencyForm.name.trim(),
      category: competencyForm.category,
      description: competencyForm.description.trim(),
      is_active: true
    }]).select().single();

    if (compErr) {
      setSubmitting(false);
      setErrorMsg('Failed to save Competency: ' + compErr.message);
      return;
    }

    // Map to domain if selected
    if (competencyForm.domain_id && comp?.id) {
      const { error: mapErr } = await supabase.from('hpc_domain_competencies').insert([{
        domain_id: competencyForm.domain_id,
        competency_id: comp.id
      }]);
      if (mapErr) console.warn('Could not map to domain:', mapErr.message);
    }

    setSubmitting(false);
    setCompetencyForm(prev => ({ ...prev, name: '', description: '' }));
    showNotification('Competency saved successfully!');
    fetchData();
  }

  // 6. Create Indicator
  async function handleCreateIndicator(e) {
    e.preventDefault();
    if (!indicatorForm.name.trim() || !indicatorForm.competency_id) return;
    setSubmitting(true);
    setErrorMsg('');
    const { error } = await supabase.from('hpc_indicators').insert([{
      name: indicatorForm.name.trim(),
      code: indicatorForm.code.trim() || null,
      description: indicatorForm.description.trim() || null,
      competency_id: indicatorForm.competency_id,
      display_order: parseInt(indicatorForm.display_order, 10) || 0,
      is_active: true
    }]);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Failed to save Indicator: ' + error.message);
    } else {
      setIndicatorForm(prev => ({ ...prev, name: '', code: '', description: '', display_order: prev.display_order + 1 }));
      showNotification('Indicator saved successfully!');
      fetchData();
    }
  }

  // 7. Create Scale Set & Levels
  async function handleCreateScaleSet(e) {
    e.preventDefault();
    if (!scaleForm.name.trim()) return;
    setSubmitting(true);
    setErrorMsg('');

    // Insert Set
    const { data: setRow, error: setErr } = await supabase.from('hpc_rating_scale_sets').insert([{
      name: scaleForm.name.trim(),
      description: scaleForm.description.trim(),
      is_active: true
    }]).select().single();

    if (setErr) {
      setSubmitting(false);
      setErrorMsg('Failed to save Rating Scale Set: ' + setErr.message);
      return;
    }

    // Insert Levels
    const levelsToInsert = scaleForm.levels.map(l => ({
      scale_set_id: setRow.id,
      level_name: l.level_name,
      numeric_value: l.numeric_value,
      color_code: l.color_code,
      display_order: l.display_order,
      is_active: true
    }));

    const { error: levelsErr } = await supabase.from('hpc_rating_scale_levels').insert(levelsToInsert);
    if (levelsErr) {
      setSubmitting(false);
      setErrorMsg('Failed to save Scale Levels: ' + levelsErr.message);
      return;
    }

    // Link to Framework if selected
    if (scaleForm.framework_id) {
      await supabase.from('hpc_framework_rating_scales').insert([{
        framework_id: scaleForm.framework_id,
        scale_set_id: setRow.id
      }]);
    }

    setSubmitting(false);
    showNotification('Rating Scale Set and Levels saved successfully!');
    fetchData();
  }

  if (authLoading) {
    return <div className="p-8 text-gray-400">Verifying administrator credentials...</div>;
  }

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-red-500 font-semibold">Access Denied. Administrator role required.</div>;
  }

  const tabs = [
    { id: 'academic_years', label: '1. Academic Years' },
    { id: 'terms', label: '2. Terms' },
    { id: 'frameworks', label: '3. Frameworks' },
    { id: 'domains', label: '4. Domains' },
    { id: 'competencies', label: '5. Competencies' },
    { id: 'indicators', label: '6. Indicators' },
    { id: 'scales', label: '7. Rating Scales' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">HPC Configuration Management</h1>
          <p className="text-sm text-gray-500 mt-1">Configure NEP/CBSE holistic progress card structure & criteria</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
        >
          {loading ? 'Refreshing...' : '↻ Refresh Data'}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg shadow-sm">
          ✅ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg shadow-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto">
          <nav className="flex px-4 space-x-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setErrorMsg(''); }}
                className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-white shadow-sm'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* TAB 1: ACADEMIC YEARS */}
          {activeTab === 'academic_years' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateYear} className="p-5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Year Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-2027"
                    value={yearForm.year_name}
                    onChange={e => setYearForm({ ...yearForm, year_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={yearForm.start_date}
                    onChange={e => setYearForm({ ...yearForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={yearForm.end_date}
                    onChange={e => setYearForm({ ...yearForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Add Academic Year
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Year Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Start Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">End Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.academic_years?.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-6 text-gray-500">No Academic Years created yet.</td></tr>
                    ) : (
                      data.academic_years?.map(y => (
                        <tr key={y.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{y.year_name}</td>
                          <td className="px-4 py-3 text-gray-600">{y.start_date || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{y.end_date || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${y.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {y.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TERMS */}
          {activeTab === 'terms' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateTerm} className="p-5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Academic Year *</label>
                  <select
                    required
                    value={termForm.academic_year_id}
                    onChange={e => setTermForm({ ...termForm, academic_year_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">-- Select Year --</option>
                    {data.academic_years?.map(y => (
                      <option key={y.id} value={y.id}>{y.year_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Term Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Term 1, Term 2"
                    value={termForm.term_name}
                    onChange={e => setTermForm({ ...termForm, term_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={submitting || !data.academic_years?.length}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Add Term
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Term Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Academic Year</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.terms?.length === 0 ? (
                      <tr><td colSpan="3" className="text-center py-6 text-gray-500">No Terms created yet.</td></tr>
                    ) : (
                      data.terms?.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{t.term_name}</td>
                          <td className="px-4 py-3 text-gray-600">{t.hpc_academic_years?.year_name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FRAMEWORKS */}
          {activeTab === 'frameworks' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateFramework} className="p-5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Academic Year *</label>
                  <select
                    required
                    value={frameworkForm.academic_year_id}
                    onChange={e => setFrameworkForm({ ...frameworkForm, academic_year_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">-- Select Year --</option>
                    {data.academic_years?.map(y => (
                      <option key={y.id} value={y.id}>{y.year_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Applicable Class *</label>
                  <select
                    required
                    value={frameworkForm.applicable_class_id}
                    onChange={e => setFrameworkForm({ ...frameworkForm, applicable_class_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">-- Select Class --</option>
                    {classes?.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Framework Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 6 Holistic Framework"
                    value={frameworkForm.name}
                    onChange={e => setFrameworkForm({ ...frameworkForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Optional details"
                    value={frameworkForm.description}
                    onChange={e => setFrameworkForm({ ...frameworkForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={submitting || !data.academic_years?.length || !classes?.length}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Add Framework
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Framework Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Year</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.frameworks?.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-6 text-gray-500">No Frameworks created yet.</td></tr>
                    ) : (
                      data.frameworks?.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{f.name}</td>
                          <td className="px-4 py-3 text-gray-600">{f.hpc_academic_years?.year_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{f.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DOMAINS */}
          {activeTab === 'domains' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateDomain} className="p-5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Parent Framework *</label>
                  <select
                    required
                    value={domainForm.framework_id}
                    onChange={e => setDomainForm({ ...domainForm, framework_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">-- Select Framework --</option>
                    {data.frameworks?.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Domain Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cognitive Development"
                    value={domainForm.name}
                    onChange={e => setDomainForm({ ...domainForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={domainForm.display_order}
                    onChange={e => setDomainForm({ ...domainForm, display_order: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={submitting || !data.frameworks?.length}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Add Domain
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Order</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Domain Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Framework</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.domains?.length === 0 ? (
                      <tr><td colSpan="3" className="text-center py-6 text-gray-500">No Domains created yet.</td></tr>
                    ) : (
                      data.domains?.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 font-mono">{d.display_order}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{d.name}</td>
                          <td className="px-4 py-3 text-gray-600">{d.hpc_frameworks?.name || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: COMPETENCIES */}
          {activeTab === 'competencies' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateCompetency} className="p-5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Competency Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Critical Thinking"
                    value={competencyForm.name}
                    onChange={e => setCompetencyForm({ ...competencyForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category *</label>
                  <select
                    value={competencyForm.category}
                    onChange={e => setCompetencyForm({ ...competencyForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="Cognitive">Cognitive</option>
                    <option value="Socio-Emotional">Socio-Emotional</option>
                    <option value="Physical">Physical & Motor</option>
                    <option value="Aesthetic">Aesthetic & Cultural</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Map to Domain</label>
                  <select
                    value={competencyForm.domain_id}
                    onChange={e => setCompetencyForm({ ...competencyForm, domain_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">-- Optional Domain --</option>
                    {data.domains?.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Add Competency
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Competency Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.competencies?.length === 0 ? (
                      <tr><td colSpan="3" className="text-center py-6 text-gray-500">No Competencies created yet.</td></tr>
                    ) : (
                      data.competencies?.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-800">
                              {c.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{c.is_active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: INDICATORS */}
          {activeTab === 'indicators' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateIndicator} className="p-5 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Competency *</label>
                  <select
                    required
                    value={indicatorForm.competency_id}
                    onChange={e => setIndicatorForm({ ...indicatorForm, competency_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">-- Select Competency --</option>
                    {data.competencies?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Indicator Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CT-01"
                    value={indicatorForm.code}
                    onChange={e => setIndicatorForm({ ...indicatorForm, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Indicator Name / Descriptor *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Identifies cause and effect"
                    value={indicatorForm.name}
                    onChange={e => setIndicatorForm({ ...indicatorForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={submitting || !data.competencies?.length}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Add Indicator
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Indicator Descriptor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Parent Competency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.indicators?.length === 0 ? (
                      <tr><td colSpan="3" className="text-center py-6 text-gray-500">No Indicators created yet.</td></tr>
                    ) : (
                      data.indicators?.map(ind => (
                        <tr key={ind.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{ind.code || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{ind.name}</td>
                          <td className="px-4 py-3 text-gray-600">{ind.hpc_competencies?.name || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: RATING SCALES */}
          {activeTab === 'scales' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateScaleSet} className="p-5 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Scale Set Name *</label>
                    <input
                      type="text"
                      required
                      value={scaleForm.name}
                      onChange={e => setScaleForm({ ...scaleForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Assign to Framework</label>
                    <select
                      value={scaleForm.framework_id}
                      onChange={e => setScaleForm({ ...scaleForm, framework_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="">-- Optional Framework Link --</option>
                      {data.frameworks?.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Scale Levels (Default 3-Level NEP scale):</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {scaleForm.levels.map((lvl, idx) => (
                      <div key={idx} className="p-3 bg-white border rounded-md flex items-center space-x-3">
                        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: lvl.color_code }}></span>
                        <div>
                          <p className="text-sm font-semibold">{lvl.level_name}</p>
                          <p className="text-xs text-gray-500">Value: {lvl.numeric_value} (Order: {lvl.display_order})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    + Save Rating Scale Set & Levels
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Level Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Scale Set</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Numeric Value</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Color</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.scale_levels?.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-6 text-gray-500">No Rating Scales created yet.</td></tr>
                    ) : (
                      data.scale_levels?.map(lvl => (
                        <tr key={lvl.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{lvl.level_name}</td>
                          <td className="px-4 py-3 text-gray-600">{lvl.hpc_rating_scale_sets?.name || '—'}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{lvl.numeric_value}</td>
                          <td className="px-4 py-3 flex items-center space-x-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lvl.color_code || '#ccc' }}></span>
                            <span className="font-mono text-xs text-gray-500">{lvl.color_code}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
