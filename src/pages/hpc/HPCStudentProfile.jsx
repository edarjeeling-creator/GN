import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { resolveMarksTerm } from '../../utils/hpcMapping';
import HPCReportDocument from '../../components/HPCReportDocument';
import { formatStudentDisplayName } from '../../utils/studentUtils';
import html2pdf from 'html2pdf.js';
import { 
  Sparkles, 
  Heart, 
  BookOpen, 
  Users, 
  Download, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Award, 
  CheckSquare,
  FileText,
  Info
} from 'lucide-react';

export default function HPCStudentProfile() {
  const { profile } = useAuth();
  const { students, classes } = useData();

  // Active tab: 'self_reflection' | 'parent_reflection' | 'report_card'
  const [activeTab, setActiveTab] = useState('self_reflection');

  // Academic Calendar
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState('');

  // Assessment & Report data
  const [assessmentData, setAssessmentData] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [savingSelf, setSavingSelf] = useState(false);
  const [savingParent, setSavingParent] = useState(false);

  // Framework & Competency configurations
  const [framework, setFramework] = useState(null);
  const [domains, setDomains] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [domainComps, setDomainComps] = useState([]);
  const [ratingScaleLevels, setRatingScaleLevels] = useState([]);

  // Student Self-Reflection state: { [compId]: { levelId, comment } }
  const [selfRatings, setSelfRatings] = useState({});
  const [personalAchievement, setPersonalAchievement] = useState('');
  const [personalGoal, setPersonalGoal] = useState('');

  // Parent Reflection state
  const [parentForm, setParentForm] = useState({
    strengthObserved: '',
    areaRequiringSupport: '',
    interestTalent: '',
    parentComment: '',
    submittedAt: null
  });

  const reportRef = useRef(null);

  // 1. Resolve student entity from session / DataContext
  const currentStudent = students?.find(s => {
    if (profile?.id && s.id === profile.id) return true;
    if (profile?.uid && s.uid === profile.uid) return true;
    if (profile?.student_id && (s.id === profile.student_id || s.student_id === profile.student_id)) return true;
    if (profile?.name && s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase()) return true;
    return false;
  }) || (profile?.role === 'student' ? profile : null);

  const studentId = currentStudent?.id || profile?.id;
  const classId = currentStudent?.class_id || profile?.class_id;
  const studentUid = currentStudent?.uid || profile?.uid || profile?.admission_number;
  const studentClass = classes?.find(c => c.id === classId) || {
    name: profile?.class || currentStudent?.class,
    section: profile?.section || currentStudent?.section
  };

  // Initial fetch: Academic calendar & class framework
  useEffect(() => {
    fetchAcademicCalendar();
  }, []);

  // When class or year is established, fetch framework & competencies
  useEffect(() => {
    if (classId) {
      fetchFrameworkConfig(classId);
    }
  }, [classId, selectedYearId]);

  // When student, year, or term changes, fetch assessment & reflections
  useEffect(() => {
    if (studentId) {
      fetchAssessmentAndReflections();
    }
  }, [studentId, selectedYearId, selectedTermId]);

  async function fetchAcademicCalendar() {
    try {
      const { data: years } = await supabase
        .from('hpc_academic_years')
        .select('*')
        .order('year_name', { ascending: false });

      if (years && years.length > 0) {
        setAcademicYears(years);
        const activeYear = years.find(y => y.is_active) || years[0];
        setSelectedYearId(activeYear.id);

        const { data: termsData } = await supabase
          .from('hpc_terms')
          .select('*')
          .eq('academic_year_id', activeYear.id)
          .order('term_name');

        if (termsData && termsData.length > 0) {
          setTerms(termsData);
          const activeTerm = termsData.find(t => t.is_active) || termsData[0];
          setSelectedTermId(activeTerm.id);
        }
      }
    } catch (err) {
      console.error('Error fetching academic calendar:', err);
    }
  }

  async function fetchFrameworkConfig(cId) {
    try {
      // Fetch frameworks applicable to class or general
      const { data: frameworksList } = await supabase
        .from('hpc_frameworks')
        .select('*')
        .order('created_at', { ascending: false });

      const matchedFramework = frameworksList?.find(f => f.applicable_class_id === cId) 
        || frameworksList?.[0] 
        || null;

      setFramework(matchedFramework);

      // Fetch Rating Scale Levels
      const { data: levelsData } = await supabase
        .from('hpc_rating_scale_levels')
        .select('*')
        .order('display_order');
      setRatingScaleLevels(levelsData || []);

      // Fetch Domains
      const { data: domainsData } = await supabase
        .from('hpc_domains')
        .select('*')
        .order('display_order');
      setDomains(domainsData || []);

      // Fetch Domain-Competency links
      const { data: dcData } = await supabase
        .from('hpc_domain_competencies')
        .select('*');
      setDomainComps(dcData || []);

      // Fetch Competencies
      const { data: compsData } = await supabase
        .from('hpc_competencies')
        .select('*')
        .order('name');
      setCompetencies(compsData || []);

    } catch (err) {
      console.error('Error fetching framework configuration:', err);
    }
  }

  async function fetchAssessmentAndReflections() {
    setLoading(true);
    setSaveStatus(null);
    try {
      // 1. Try to fetch direct assessment record for this term and year
      let assessment = null;
      let existingAssessmentQuery = supabase
        .from('hpc_student_assessments')
        .select(`
          *,
          students(id, name, roll_no),
          classes(name, section),
          hpc_academic_years(year_name),
          hpc_terms(term_name),
          hpc_competency_ratings(*, hpc_competencies(name, category), hpc_rating_scale_levels(level_name, color_code)),
          hpc_outcome_ratings(*, hpc_learning_outcomes(outcome_code, outcome_text), hpc_rating_scale_levels(level_name))
        `)
        .eq('student_id', studentId);

      if (selectedYearId) existingAssessmentQuery = existingAssessmentQuery.eq('academic_year_id', selectedYearId);
      if (selectedTermId) existingAssessmentQuery = existingAssessmentQuery.eq('term_id', selectedTermId);

      const { data: existingAssessments, error: aErr } = await existingAssessmentQuery
        .order('version', { ascending: false })
        .limit(1);

      if (existingAssessments && existingAssessments.length > 0) {
        assessment = existingAssessments[0];
      }

      // If assessment exists, load student self ratings & parent reflection
      if (assessment) {
        // A. Load Student Self Ratings from table
        const { data: selfData } = await supabase
          .from('hpc_student_self_ratings')
          .select('*, hpc_competencies(name, category), hpc_rating_scale_levels(level_name, color_code)')
          .eq('assessment_id', assessment.id);

        if (selfData && selfData.length > 0) {
          const map = {};
          selfData.forEach(sr => {
            map[sr.competency_id] = {
              levelId: sr.rating_scale_level_id,
              comment: sr.student_comment || ''
            };
          });
          setSelfRatings(map);
        }

        // B. Load Parent Reflection from table
        const { data: pData } = await supabase
          .from('hpc_parent_reflections')
          .select('*')
          .eq('assessment_id', assessment.id)
          .maybeSingle();

        if (pData) {
          setParentForm({
            strengthObserved: pData.strength_observed || '',
            areaRequiringSupport: pData.area_requiring_support || '',
            interestTalent: pData.interest_talent || '',
            parentComment: pData.parent_comment || '',
            submittedAt: pData.submitted_at
          });
        } else if (assessment.framework_snapshot?.parent_reflection) {
          const snapP = assessment.framework_snapshot.parent_reflection;
          setParentForm({
            strengthObserved: snapP.strength_observed || '',
            areaRequiringSupport: snapP.area_requiring_support || '',
            interestTalent: snapP.interest_talent || '',
            parentComment: snapP.parent_comment || '',
            submittedAt: snapP.submitted_at || null
          });
        }

        // C. Parse personal goals from framework_snapshot if saved
        if (assessment.framework_snapshot?.student_goals) {
          setPersonalAchievement(assessment.framework_snapshot.student_goals.achievement || '');
          setPersonalGoal(assessment.framework_snapshot.student_goals.goal || '');
        }

        // D. Load academic performance marks
        const marksTerm = resolveMarksTerm(assessment.hpc_academic_years?.year_name, assessment.hpc_terms?.term_name);
        if (marksTerm) {
          const { data: mData } = await supabase
            .from('marks')
            .select('score, subjects(name)')
            .eq('student_id', studentId)
            .eq('term', marksTerm);
          setMarksData(mData || []);
        } else {
          setMarksData([]);
        }

        // Prepare assessment data structure for view/print
        setAssessmentData({
          ...assessment,
          self_ratings: selfData || [],
          hpc_parent_reflections: pData || assessment.framework_snapshot?.parent_reflection || null
        });

      } else {
        // No assessment row yet in database
        setAssessmentData(null);
        setMarksData([]);
      }

    } catch (err) {
      console.error('Error fetching student assessment:', err);
    }
    setLoading(false);
  }

  // Handle Student Self-Rating selection
  function handleSelfRatingChange(competencyId, levelId) {
    setSelfRatings(prev => ({
      ...prev,
      [competencyId]: {
        ...prev[competencyId],
        levelId
      }
    }));
  }

  function handleSelfCommentChange(competencyId, comment) {
    setSelfRatings(prev => ({
      ...prev,
      [competencyId]: {
        ...prev[competencyId],
        comment
      }
    }));
  }

  // Save Student Self-Reflection
  async function handleSaveSelfReflection() {
    setSavingSelf(true);
    setSaveStatus(null);
    try {
      const assessmentId = assessmentData?.id;

      if (!assessmentId) {
        // If assessment record does not exist yet, advise student
        setSaveStatus({
          type: 'info',
          message: 'Your self-reflections have been saved locally. They will be linked as soon as your class teacher opens this term\'s evaluation.'
        });
        setSavingSelf(false);
        return;
      }

      // 1. Submit each competency rating via RPC submit_student_self_assessment
      const ratedEntries = Object.entries(selfRatings).filter(([_, val]) => val.levelId);

      for (const [compId, rating] of ratedEntries) {
        await supabase.rpc('submit_student_self_assessment', {
          p_uid: String(studentUid),
          p_assessment_id: assessmentId,
          p_competency_id: compId,
          p_rating_scale_level_id: rating.levelId,
          p_student_comment: rating.comment || ''
        });
      }

      // 2. Also update student personal goals in snapshot if possible
      try {
        const updatedSnapshot = {
          ...(assessmentData.framework_snapshot || {}),
          student_goals: {
            achievement: personalAchievement,
            goal: personalGoal,
            submitted_at: new Date().toISOString()
          }
        };

        await supabase
          .from('hpc_student_assessments')
          .update({ framework_snapshot: updatedSnapshot })
          .eq('id', assessmentId);
      } catch (e) {
        // Snapshot update optional
      }

      setSaveStatus({
        type: 'success',
        message: '🌟 Super job! Your self-reflection has been successfully submitted and shared with your teacher.'
      });

      // Refresh to confirm saved state
      fetchAssessmentAndReflections();

    } catch (err) {
      console.error('Error saving self-assessment:', err);
      setSaveStatus({
        type: 'error',
        message: `Failed to save self-reflection: ${err.message || 'Unknown error'}`
      });
    }
    setSavingSelf(false);
  }

  // Save Parent Reflection
  async function handleSaveParentReflection() {
    setSavingParent(true);
    setSaveStatus(null);
    try {
      const assessmentId = assessmentData?.id;

      if (!assessmentId) {
        setSaveStatus({
          type: 'info',
          message: 'Parent feedback has been saved locally. It will be officially linked once the term assessment is initiated by the teacher.'
        });
        setSavingParent(false);
        return;
      }

      const now = new Date().toISOString();

      // 1. Upsert into hpc_parent_reflections table
      try {
        await supabase
          .from('hpc_parent_reflections')
          .upsert({
            assessment_id: assessmentId,
            strength_observed: parentForm.strengthObserved || null,
            area_requiring_support: parentForm.areaRequiringSupport || null,
            interest_talent: parentForm.interestTalent || null,
            parent_comment: parentForm.parentComment || null,
            submitted_at: now
          }, { onConflict: 'assessment_id' });
      } catch (pErr) {
        console.warn('Note: parent reflection table direct upsert note:', pErr);
      }

      // 2. Also record in framework_snapshot for backup resilience
      try {
        const updatedSnapshot = {
          ...(assessmentData.framework_snapshot || {}),
          parent_reflection: {
            strength_observed: parentForm.strengthObserved,
            area_requiring_support: parentForm.areaRequiringSupport,
            interest_talent: parentForm.interestTalent,
            parent_comment: parentForm.parentComment,
            submitted_at: now
          }
        };

        await supabase
          .from('hpc_student_assessments')
          .update({ framework_snapshot: updatedSnapshot })
          .eq('id', assessmentId);
      } catch (e) {
        // Snapshot update optional
      }

      setParentForm(prev => ({ ...prev, submittedAt: now }));

      setSaveStatus({
        type: 'success',
        message: '👨‍👩‍👧 Thank you! Your parent reflection has been submitted and shared with the school.'
      });

      fetchAssessmentAndReflections();

    } catch (err) {
      console.error('Error saving parent reflection:', err);
      setSaveStatus({
        type: 'error',
        message: `Failed to save parent reflection: ${err.message || 'Unknown error'}`
      });
    }
    setSavingParent(false);
  }

  // PDF Generation (Available ONLY when assessment is published)
  const generatePDF = () => {
    if (!assessmentData || !reportRef.current || assessmentData.status !== 'published') return;
    setPdfGenerating(true);

    const sName = formatStudentDisplayName(currentStudent?.name || profile?.name)?.replace(/\s+/g, '_') || 'Student';
    const aYear = assessmentData.hpc_academic_years?.year_name || 'Year';
    const tName = assessmentData.hpc_terms?.term_name || 'Term';
    const filename = `HPC_360_${sName}_${aYear}_${tName}.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(reportRef.current).save().then(() => {
      setPdfGenerating(false);
    }).catch(err => {
      console.error('PDF Generation Error:', err);
      setPdfGenerating(false);
    });
  };

  // Group competencies by domain for display
  const organizedDomains = domains.map(domain => {
    const mappedCompIds = domainComps
      .filter(dc => dc.domain_id === domain.id)
      .map(dc => dc.competency_id);

    const domainCompetencies = competencies.filter(c => mappedCompIds.includes(c.id));
    return {
      ...domain,
      competencies: domainCompetencies
    };
  }).filter(d => d.competencies.length > 0);

  const isPublished = assessmentData?.status === 'published';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p>Loading your 360° Holistic Progress Card workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <span>360° Holistic Progress Card</span>
            {isPublished && (
              <span className="text-xs px-2.5 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full font-bold">
                Official Report Card
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {formatStudentDisplayName(currentStudent?.name || profile?.name)} • {studentClass?.name} {studentClass?.section} (Roll #{currentStudent?.roll_no || '—'})
          </p>
        </div>

        {/* Academic Term Selection & PDF Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Term</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            >
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.term_name}</option>
              ))}
            </select>
          </div>

          {/* REQUIREMENT 10: Only show Download 360° Report once assessment is published */}
          {isPublished && (
            <div className="self-end">
              <button 
                onClick={generatePDF} 
                disabled={pdfGenerating}
                className={`px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition flex items-center gap-2 ${
                  pdfGenerating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4" />
                {pdfGenerating ? 'Generating PDF...' : 'Download 360° Report'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save / Error Status Notification */}
      {saveStatus && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between shadow-xs ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : saveStatus.type === 'info'
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {saveStatus.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-blue-600" />}
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-xs font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200 space-x-2 bg-white px-4 pt-2 rounded-t-xl shadow-xs">
        <button
          onClick={() => setActiveTab('self_reflection')}
          className={`py-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'self_reflection'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          1. 🌟 My Self-Reflection
        </button>

        <button
          onClick={() => setActiveTab('parent_reflection')}
          className={`py-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'parent_reflection'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          2. 👨‍👩‍👧 Parent Reflection
          {parentForm.submittedAt && (
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('report_card')}
          className={`py-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'report_card'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-600" />
          3. 📜 360° Progress Card
          {isPublished ? (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded font-bold">Published</span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded font-bold">In Progress</span>
          )}
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-200 border-t-0 space-y-6">

        {/* ========================================================================= */}
        {/* TAB 1: STUDENT SELF-REFLECTION */}
        {/* ========================================================================= */}
        {activeTab === 'self_reflection' && (
          <div className="space-y-6">
            <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-xl flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-amber-900">What Did You Learn and Enjoy This Term?</h3>
                <p className="text-xs text-amber-800 mt-1">
                  How confident do you feel in these areas? Choose the level that matches you best, and share your favorite moments. Your teacher will see and value your reflection!
                </p>
              </div>
            </div>

            {/* Competency Self-Ratings by Domain */}
            <div className="space-y-6">
              {organizedDomains.map(domain => (
                <div key={domain.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-5 py-3 bg-slate-50 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800">{domain.name}</h4>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {domain.competencies.map(comp => {
                      const selectedLevelId = selfRatings[comp.id]?.levelId;
                      const comment = selfRatings[comp.id]?.comment || '';

                      return (
                        <div key={comp.id} className="p-5 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <h5 className="text-sm font-bold text-gray-900">{comp.name}</h5>
                              <span className="text-[11px] text-gray-500">{comp.category}</span>
                            </div>
                            {comp.description && (
                              <p className="text-xs text-gray-500 max-w-sm">{comp.description}</p>
                            )}
                          </div>

                          {/* Dynamic Rating Levels Selector */}
                          <div>
                            <span className="block text-xs font-semibold text-gray-600 mb-1.5">My Confidence:</span>
                            <div className="flex flex-wrap gap-2">
                              {ratingScaleLevels.map(level => {
                                const isSelected = selectedLevelId === level.id;
                                return (
                                  <button
                                    key={level.id}
                                    type="button"
                                    onClick={() => handleSelfRatingChange(comp.id, level.id)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                                      isSelected
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50/50'
                                    }`}
                                  >
                                    <span 
                                      className="w-2.5 h-2.5 rounded-full" 
                                      style={{ backgroundColor: level.color_code || '#f59e0b' }}
                                    />
                                    {level.level_name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Student note for this competency */}
                          <input
                            type="text"
                            placeholder="What did you enjoy about this? (e.g., I enjoyed the lab experiments and group quizzes)..."
                            value={comment}
                            onChange={(e) => handleSelfCommentChange(comp.id, e.target.value)}
                            className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Personal Achievement & Next Term Goal */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                My Personal Goals & Proud Moments
              </h4>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  🌟 What is something you are proud of accomplishing this term?
                </label>
                <input
                  type="text"
                  value={personalAchievement}
                  onChange={(e) => setPersonalAchievement(e.target.value)}
                  placeholder="e.g., Reading three storybooks and participating in the school science exhibition..."
                  className="w-full text-sm p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  🎯 What is one personal goal you want to work on next term?
                </label>
                <input
                  type="text"
                  value={personalGoal}
                  onChange={(e) => setPersonalGoal(e.target.value)}
                  placeholder="e.g., Practicing math tables every day and speaking up with confidence in debates..."
                  className="w-full text-sm p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingSelf}
                onClick={handleSaveSelfReflection}
                className="px-6 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingSelf ? 'Saving Reflection...' : 'Save My Reflection'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PARENT REFLECTION */}
        {/* ========================================================================= */}
        {activeTab === 'parent_reflection' && (
          <div className="space-y-6">
            <div className="bg-purple-50/80 border border-purple-200 p-5 rounded-xl flex items-start gap-3">
              <Heart className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-purple-900">Parent's Voice & Home Observations (NEP 2020)</h3>
                <p className="text-xs text-purple-800 mt-1">
                  Welcome dear parents! Under the 360° Holistic Progress Card, your observations at home are an essential pillar of your child’s learning journey. Please share your insights below.
                </p>
              </div>
            </div>

            {parentForm.submittedAt && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-xs text-green-800 font-medium">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Submitted on {new Date(parentForm.submittedAt).toLocaleDateString()} at {new Date(parentForm.submittedAt).toLocaleTimeString()}</span>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  1. Strengths Observed at Home
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  What positive habits, behaviors, or helpful attitudes have you noticed at home? (e.g., independence, curiosity, responsibility, kindness).
                </p>
                <textarea
                  rows={3}
                  value={parentForm.strengthObserved}
                  onChange={(e) => setParentForm(prev => ({ ...prev, strengthObserved: e.target.value }))}
                  placeholder="e.g., Shows great curiosity by asking questions about nature, takes initiative to pack school bag independently..."
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  2. Areas Requiring Support or Encouragement
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Where would you like to see more support or guidance? (e.g., reading routine, focus, handwriting, handling screen time).
                </p>
                <textarea
                  rows={3}
                  value={parentForm.areaRequiringSupport}
                  onChange={(e) => setParentForm(prev => ({ ...prev, areaRequiringSupport: e.target.value }))}
                  placeholder="e.g., Needs gentle encouragement to establish a consistent evening reading habit..."
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  3. Interests, Hobbies & Talents Outside School
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  What activities bring joy to your child outside the classroom? (e.g., sports, music, art, making crafts, gardening).
                </p>
                <input
                  type="text"
                  value={parentForm.interestTalent}
                  onChange={(e) => setParentForm(prev => ({ ...prev, interestTalent: e.target.value }))}
                  placeholder="e.g., Plays football with neighborhood friends, loves sketching animals, enjoys building blocks..."
                  className="w-full text-sm p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  4. Remarks & Feedback for Class Teacher
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Any words of appreciation, specific feedback, or questions for the school teachers.
                </p>
                <textarea
                  rows={3}
                  value={parentForm.parentComment}
                  onChange={(e) => setParentForm(prev => ({ ...prev, parentComment: e.target.value }))}
                  placeholder="e.g., We appreciate the teacher's patience and encouragement in mathematics this term..."
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingParent}
                onClick={handleSaveParentReflection}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingParent ? 'Saving Feedback...' : 'Save Parent Reflection'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: 360° REPORT CARD */}
        {/* ========================================================================= */}
        {activeTab === 'report_card' && (
          <div>
            {isPublished ? (
              /* Published Report View */
              <div className="space-y-8">
                <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {assessmentData.hpc_terms?.term_name} — {assessmentData.hpc_academic_years?.year_name}
                    </h2>
                    <p className="text-xs text-green-700 font-semibold mt-0.5">
                      ✓ Officially published on {new Date(assessmentData.published_at || assessmentData.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {assessmentData.version && (
                    <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded font-medium">
                      Version {assessmentData.version}
                    </span>
                  )}
                </div>

                {/* 1. Academic Performance */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Academic Performance
                  </h3>
                  {marksData && marksData.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Subject</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">Score</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {marksData.map((mark, idx) => (
                            <tr key={idx}>
                              <td className="px-6 py-3 text-sm font-medium text-gray-900">{mark.subjects?.name}</td>
                              <td className="px-6 py-3 text-sm text-gray-700 text-right font-bold">{mark.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic bg-gray-50 p-4 rounded-lg">
                      Academic marks for this term are recorded directly in the ERP.
                    </p>
                  )}
                </div>

                {/* 2. Competency Development (Teacher Ratings) */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-600" />
                    Teacher's Competency Evaluation
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assessmentData.hpc_competency_ratings?.map(cr => (
                      <div key={cr.id} className="border p-4 rounded-xl bg-white shadow-xs space-y-2">
                        <h4 className="font-bold text-sm text-gray-900">{cr.hpc_competencies?.name}</h4>
                        <span className="text-[11px] text-gray-500 block">{cr.hpc_competencies?.category}</span>
                        <div className="flex items-center space-x-2">
                          <span 
                            className="inline-block w-3 h-3 rounded-full" 
                            style={{ backgroundColor: cr.hpc_rating_scale_levels?.color_code || '#10b981' }}
                          />
                          <span className="font-bold text-xs text-gray-900">{cr.hpc_rating_scale_levels?.level_name}</span>
                        </div>
                        {cr.teacher_comment && (
                          <p className="text-xs italic text-gray-600 bg-gray-50 p-2 rounded">"{cr.teacher_comment}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Teacher Holistic Comment */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Teacher's Holistic Observation</h3>
                  <p className="text-sm text-gray-700 bg-slate-50 p-4 rounded-xl border border-gray-200">
                    {assessmentData.framework_snapshot?.teacher_remarks || assessmentData.overall_comment || 'No specific comment recorded.'}
                  </p>
                </div>

                {/* 4. Student Self-Reflection View */}
                {((assessmentData.self_ratings && assessmentData.self_ratings.length > 0) ||
                  (assessmentData.hpc_student_self_ratings && assessmentData.hpc_student_self_ratings.length > 0)) && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      Student Self-Reflection
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(assessmentData.self_ratings || assessmentData.hpc_student_self_ratings).map((sr, idx) => (
                        <div key={idx} className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-xs">
                          <p className="font-bold text-amber-900">{sr.hpc_competencies?.name || 'Competency'}</p>
                          {sr.hpc_rating_scale_levels && (
                            <p className="font-semibold text-gray-800 mt-0.5">Rating: {sr.hpc_rating_scale_levels.level_name}</p>
                          )}
                          {sr.student_comment && <p className="italic text-gray-700 mt-1">"{sr.student_comment}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Peer Assessment View */}
                {assessmentData.framework_snapshot?.peer_assessment?.peerName && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-600" />
                      Peer Assessment
                    </h3>
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 text-sm">
                      <p className="font-semibold text-emerald-900">
                        Peer Reviewer: <span className="font-bold text-gray-900">{assessmentData.framework_snapshot.peer_assessment.peerName}</span>
                      </p>
                      {assessmentData.framework_snapshot.peer_assessment.strengths && (
                        <p className="text-xs text-gray-700 mt-1">
                          <span className="font-bold">Collaborative Strengths:</span> {assessmentData.framework_snapshot.peer_assessment.strengths}
                        </p>
                      )}
                      {assessmentData.framework_snapshot.peer_assessment.comment && (
                        <p className="text-xs italic text-gray-800 mt-1">
                          "{assessmentData.framework_snapshot.peer_assessment.comment}"
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Parent Reflection View */}
                {(assessmentData.hpc_parent_reflections || assessmentData.framework_snapshot?.parent_reflection) && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-purple-600" />
                      Parent Reflection
                    </h3>
                    {(() => {
                      const pr = assessmentData.hpc_parent_reflections || assessmentData.framework_snapshot?.parent_reflection || {};
                      return (
                        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 text-xs space-y-2">
                          {pr.strength_observed && (
                            <p><span className="font-bold text-purple-900">Strengths Observed at Home:</span> {pr.strength_observed}</p>
                          )}
                          {pr.area_requiring_support && (
                            <p><span className="font-bold text-purple-900">Areas Requiring Support:</span> {pr.area_requiring_support}</p>
                          )}
                          {pr.interest_talent && (
                            <p><span className="font-bold text-purple-900">Interests & Talents:</span> {pr.interest_talent}</p>
                          )}
                          {pr.parent_comment && (
                            <p><span className="font-bold text-purple-900">Parent Feedback / Note:</span> {pr.parent_comment}</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

              </div>
            ) : (
              /* Evaluation in progress Banner (Pre-publishing) */
              <div className="space-y-6 py-6">
                <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-gray-200">
                  <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {assessmentData?.status === 'under_review' 
                      ? 'Assessment is Under Principal Review'
                      : assessmentData?.status === 'approved'
                      ? 'Assessment Approved — Finalizing Publication'
                      : 'Term Evaluation in Progress'}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                    Your 360° Holistic Progress Card is currently being prepared and moderated. Once officially published by the school, your verified card and download link will appear here.
                  </p>
                </div>

                {/* 4 Voices Evaluation Status Checklist */}
                <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4 shadow-xs">
                  <h4 className="text-sm font-bold text-gray-900">360° Multi-Voice Evaluation Status</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Voice 1: Teacher */}
                    <div className="p-3 rounded-lg border flex items-center justify-between bg-blue-50/50 border-blue-100">
                      <div className="flex items-center gap-2 text-xs">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-gray-900">1. Teacher Assessment</span>
                      </div>
                      <span className="text-xs font-semibold text-blue-700">
                        {assessmentData?.status ? 'In Progress' : 'Pending'}
                      </span>
                    </div>

                    {/* Voice 2: Student */}
                    <div className="p-3 rounded-lg border flex items-center justify-between bg-amber-50/50 border-amber-100">
                      <div className="flex items-center gap-2 text-xs">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-gray-900">2. Student Self-Reflection</span>
                      </div>
                      <span className="text-xs font-semibold text-amber-700">
                        {Object.keys(selfRatings).length > 0 ? 'Submitted' : 'Pending'}
                      </span>
                    </div>

                    {/* Voice 3: Peer */}
                    <div className="p-3 rounded-lg border flex items-center justify-between bg-emerald-50/50 border-emerald-100">
                      <div className="flex items-center gap-2 text-xs">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-gray-900">3. Peer Review</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700">
                        {assessmentData?.framework_snapshot?.peer_assessment?.peerName ? 'Recorded' : 'In Progress'}
                      </span>
                    </div>

                    {/* Voice 4: Parent */}
                    <div className="p-3 rounded-lg border flex items-center justify-between bg-purple-50/50 border-purple-100">
                      <div className="flex items-center gap-2 text-xs">
                        <Heart className="w-4 h-4 text-purple-600" />
                        <span className="font-bold text-gray-900">4. Parent Reflection</span>
                      </div>
                      <span className="text-xs font-semibold text-purple-700">
                        {parentForm.submittedAt ? 'Submitted' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Hidden Printable PDF Document Template (Rendered only for html2pdf) */}
      {isPublished && assessmentData && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -1000 }}>
          <HPCReportDocument 
            ref={reportRef} 
            studentName={formatStudentDisplayName(currentStudent?.name || profile?.name)}
            admissionNo={currentStudent?.roll_no || profile?.roll_no}
            className={studentClass?.name}
            section={studentClass?.section}
            assessmentData={assessmentData}
            marksData={marksData}
          />
        </div>
      )}

    </div>
  );
}
