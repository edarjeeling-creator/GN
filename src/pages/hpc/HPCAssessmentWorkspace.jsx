import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatStudentDisplayName } from '../../utils/studentUtils';
import { 
  User, 
  Users, 
  Award, 
  BookOpen, 
  Heart, 
  Sparkles, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Save, 
  Send, 
  FileText, 
  X, 
  AlertCircle,
  ChevronRight,
  Info
} from 'lucide-react';

export default function HPCAssessmentWorkspace() {
  const { profile } = useAuth();
  const { classes } = useData();
  
  // Selection states
  const [selectedClass, setSelectedClass] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  
  // Configuration states (Dynamic framework)
  const [framework, setFramework] = useState(null);
  const [domains, setDomains] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [domainComps, setDomainComps] = useState([]);
  const [ratingScaleLevels, setRatingScaleLevels] = useState([]);
  
  // Student list & loading
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerTab, setDrawerTab] = useState('teacher'); // 'teacher' | 'student' | 'peer' | 'parent'
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Form states inside drawer
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [teacherRatings, setTeacherRatings] = useState({}); // { [compId]: { levelId, comment } }
  const [teacherRemarks, setTeacherRemarks] = useState('');
  const [studentSelfRatings, setStudentSelfRatings] = useState([]);
  const [peerData, setPeerData] = useState({
    peerStudentId: '',
    peerName: '',
    strengths: '',
    comment: ''
  });
  const [parentData, setParentData] = useState({
    strengthObserved: '',
    areaRequiringSupport: '',
    interestTalent: '',
    parentComment: '',
    submittedAt: null,
    isParentSubmitted: false
  });

  // Filter accessible classes based on role
  const availableClasses = (profile?.role === 'admin' || profile?.role === 'principal')
    ? (classes || [])
    : (classes?.filter(c => 
        c.class_teacher_id === profile?.id || 
        c.teacher_subjects?.some(ts => ts.teacher_id === profile?.id)
      ) || []);

  // Fetch academic years & terms on mount
  useEffect(() => {
    fetchAcademicCalendar();
  }, []);

  // Fetch framework & configuration when class or academic year changes
  useEffect(() => {
    if (selectedClass) {
      fetchClassConfiguration(selectedClass);
    }
  }, [selectedClass, selectedYearId]);

  // Fetch students when class or term changes
  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass, selectedTermId]);

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

        // Fetch terms for active year
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

  // When year dropdown changes, refresh terms
  async function handleYearChange(yearId) {
    setSelectedYearId(yearId);
    try {
      const { data: termsData } = await supabase
        .from('hpc_terms')
        .select('*')
        .eq('academic_year_id', yearId)
        .order('term_name');

      if (termsData && termsData.length > 0) {
        setTerms(termsData);
        setSelectedTermId(termsData[0].id);
      } else {
        setTerms([]);
        setSelectedTermId('');
      }
    } catch (err) {
      console.error('Error fetching terms for year:', err);
    }
  }

  async function fetchClassConfiguration(classId) {
    setConfigLoading(true);
    try {
      // 1. Fetch applicable framework for this class or general framework
      let frameworkQuery = supabase
        .from('hpc_frameworks')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedYearId) {
        frameworkQuery = frameworkQuery.eq('academic_year_id', selectedYearId);
      }

      const { data: frameworksList } = await frameworkQuery;

      // Find framework matching class, or fallback to first available
      const matchedFramework = frameworksList?.find(f => f.applicable_class_id === classId) 
        || frameworksList?.[0] 
        || null;

      setFramework(matchedFramework);

      // 2. Fetch Rating Scale Levels
      const { data: levelsData } = await supabase
        .from('hpc_rating_scale_levels')
        .select('*')
        .order('display_order');
      setRatingScaleLevels(levelsData || []);

      // 3. Fetch Domains
      let domainsData = [];
      if (matchedFramework) {
        const { data: dData } = await supabase
          .from('hpc_domains')
          .select('*')
          .eq('framework_id', matchedFramework.id)
          .order('display_order');
        domainsData = dData || [];
      } else {
        const { data: dData } = await supabase
          .from('hpc_domains')
          .select('*')
          .order('display_order');
        domainsData = dData || [];
      }
      setDomains(domainsData);

      // 4. Fetch Domain-Competency Mappings
      const { data: dcData } = await supabase
        .from('hpc_domain_competencies')
        .select('*');
      setDomainComps(dcData || []);

      // 5. Fetch Competencies
      const { data: compsData } = await supabase
        .from('hpc_competencies')
        .select('*')
        .order('name');
      setCompetencies(compsData || []);

    } catch (err) {
      console.error('Error fetching HPC configuration:', err);
    }
    setConfigLoading(false);
  }

  async function fetchStudents(classId) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, hpc_student_assessments(*)')
        .eq('class_id', classId)
        .order('roll_no');
      
      if (data) setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
    setLoading(false);
  }

  // Open the Teacher Assessment Drawer for a student
  async function openAssessmentDrawer(student) {
    setSelectedStudent(student);
    setIsDrawerOpen(true);
    setDrawerTab('teacher');
    setDrawerLoading(true);
    setStatusMessage(null);

    // Reset temporary state
    setTeacherRatings({});
    setTeacherRemarks('');
    setStudentSelfRatings([]);
    setPeerData({ peerStudentId: '', peerName: '', strengths: '', comment: '' });
    setParentData({ strengthObserved: '', areaRequiringSupport: '', interestTalent: '', parentComment: '', submittedAt: null, isParentSubmitted: false });

    try {
      // 1. Fetch or locate existing assessment for this student, year, and term
      let assessment = null;
      if (selectedYearId && selectedTermId) {
        const { data: existingAssessment } = await supabase
          .from('hpc_student_assessments')
          .select('*')
          .eq('student_id', student.id)
          .eq('academic_year_id', selectedYearId)
          .eq('term_id', selectedTermId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        assessment = existingAssessment;
      }

      setCurrentAssessment(assessment);

      if (assessment) {
        // A. Load Teacher Competency Ratings
        const { data: compRatings } = await supabase
          .from('hpc_competency_ratings')
          .select('*')
          .eq('assessment_id', assessment.id);

        if (compRatings && compRatings.length > 0) {
          const rMap = {};
          compRatings.forEach(r => {
            rMap[r.competency_id] = {
              ratingScaleLevelId: r.rating_scale_level_id,
              comment: r.teacher_comment || ''
            };
          });
          setTeacherRatings(rMap);
        }

        // B. Load Student Self-Ratings
        const { data: selfRatings } = await supabase
          .from('hpc_student_self_ratings')
          .select('*, hpc_competencies(name, category), hpc_rating_scale_levels(level_name, color_code)')
          .eq('assessment_id', assessment.id);

        if (selfRatings) {
          setStudentSelfRatings(selfRatings);
        }

        // C. Load Parent Reflections from table
        const { data: parentReflection } = await supabase
          .from('hpc_parent_reflections')
          .select('*')
          .eq('assessment_id', assessment.id)
          .maybeSingle();

        if (parentReflection) {
          setParentData({
            strengthObserved: parentReflection.strength_observed || '',
            areaRequiringSupport: parentReflection.area_requiring_support || '',
            interestTalent: parentReflection.interest_talent || '',
            parentComment: parentReflection.parent_comment || '',
            submittedAt: parentReflection.submitted_at,
            isParentSubmitted: !!parentReflection.submitted_at
          });
        }

        // D. Parse Teacher Remarks & Peer Feedback from framework_snapshot and overall_comment
        const snapshot = assessment.framework_snapshot || {};
        
        if (snapshot.peer_assessment) {
          setPeerData({
            peerStudentId: snapshot.peer_assessment.peer_student_id || '',
            peerName: snapshot.peer_assessment.peer_name || '',
            strengths: snapshot.peer_assessment.strengths || '',
            comment: snapshot.peer_assessment.comment || ''
          });
        }

        if (snapshot.teacher_remarks) {
          setTeacherRemarks(snapshot.teacher_remarks);
        } else if (assessment.overall_comment) {
          // If plain text overall_comment, check for [Teacher Observation] or use as is
          setTeacherRemarks(assessment.overall_comment);
        }

        // Fallback for parent data from snapshot if table wasn't queried
        if (!parentReflection && snapshot.parent_reflection) {
          setParentData({
            strengthObserved: snapshot.parent_reflection.strength_observed || '',
            areaRequiringSupport: snapshot.parent_reflection.area_requiring_support || '',
            interestTalent: snapshot.parent_reflection.interest_talent || '',
            parentComment: snapshot.parent_reflection.parent_comment || '',
            submittedAt: snapshot.parent_reflection.submitted_at || null,
            isParentSubmitted: !!snapshot.parent_reflection.submitted_at
          });
        }
      }
    } catch (err) {
      console.error('Error opening assessment drawer:', err);
    }
    setDrawerLoading(false);
  }

  function closeAssessmentDrawer() {
    setIsDrawerOpen(false);
    setSelectedStudent(null);
    setCurrentAssessment(null);
    setStatusMessage(null);
  }

  // Handle rating selection for a competency
  function handleRatingSelect(competencyId, levelId) {
    setTeacherRatings(prev => ({
      ...prev,
      [competencyId]: {
        ...prev[competencyId],
        ratingScaleLevelId: levelId
      }
    }));
  }

  // Handle comment update for a competency
  function handleCompetencyCommentChange(competencyId, comment) {
    setTeacherRatings(prev => ({
      ...prev,
      [competencyId]: {
        ...prev[competencyId],
        comment
      }
    }));
  }

  // Format overall remarks for backward-compatibility with plain text views
  function formatCombinedRemarks(teacherText, peerInfo) {
    let combined = teacherText.trim();
    if (peerInfo.peerName || peerInfo.comment) {
      combined += `\n\n[Peer Observation by ${peerInfo.peerName || 'Classmate'}]: ${peerInfo.comment || ''}`;
      if (peerInfo.strengths) {
        combined += ` (Collaborative Strengths: ${peerInfo.strengths})`;
      }
    }
    return combined;
  }

  // Save assessment (as draft or submitted for review)
  async function handleSaveAssessment(targetStatus = 'draft') {
    if (!selectedStudent || !selectedClass || !selectedYearId || !selectedTermId) {
      setStatusMessage({ type: 'error', text: 'Missing required class, year, or term selection.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      let assessmentId = currentAssessment?.id;
      const combinedComment = formatCombinedRemarks(teacherRemarks, peerData);
      
      const frameworkSnapshot = {
        ...(currentAssessment?.framework_snapshot || {}),
        teacher_remarks: teacherRemarks,
        peer_assessment: peerData,
        parent_reflection: parentData,
        updated_by_teacher_id: profile?.id,
        saved_at: new Date().toISOString()
      };

      // 1. Insert or Update Assessment Record
      if (!assessmentId) {
        const { data: newAssessment, error: insertErr } = await supabase
          .from('hpc_student_assessments')
          .insert({
            student_id: selectedStudent.id,
            class_id: selectedClass,
            academic_year_id: selectedYearId,
            term_id: selectedTermId,
            teacher_id: profile?.id,
            status: 'draft',
            version: 1,
            overall_comment: combinedComment,
            framework_snapshot: frameworkSnapshot
          })
          .select()
          .single();

        if (insertErr) throw insertErr;
        assessmentId = newAssessment.id;
        setCurrentAssessment(newAssessment);
      } else {
        // If updating an existing assessment:
        // Follow trigger transition rules:
        // draft -> submitted -> under_review
        const currentStatus = currentAssessment.status || 'draft';
        let updateStatus = currentStatus;

        if (targetStatus === 'draft') {
          updateStatus = currentStatus === 'draft' ? 'draft' : currentStatus;
        } else if (targetStatus === 'under_review') {
          // If moving to review, first transition through 'submitted' if in 'draft' or 'returned'
          if (currentStatus === 'draft' || currentStatus === 'returned') {
            await supabase
              .from('hpc_student_assessments')
              .update({ status: 'submitted', submitted_at: new Date().toISOString() })
              .eq('id', assessmentId);
            updateStatus = 'under_review';
          } else if (currentStatus === 'submitted') {
            updateStatus = 'under_review';
          }
        }

        const { data: updatedAssessment, error: updateErr } = await supabase
          .from('hpc_student_assessments')
          .update({
            status: updateStatus,
            overall_comment: combinedComment,
            framework_snapshot: frameworkSnapshot,
            updated_at: new Date().toISOString()
          })
          .eq('id', assessmentId)
          .select()
          .single();

        if (updateErr) throw updateErr;
        setCurrentAssessment(updatedAssessment);
      }

      // 2. Save Teacher Competency Ratings
      const ratingsToUpsert = Object.entries(teacherRatings)
        .filter(([_, val]) => val.ratingScaleLevelId)
        .map(([compId, val]) => ({
          assessment_id: assessmentId,
          competency_id: compId,
          rating_scale_level_id: val.ratingScaleLevelId,
          teacher_comment: val.comment || null,
          assessed_by: profile?.id,
          assessed_at: new Date().toISOString()
        }));

      if (ratingsToUpsert.length > 0) {
        const { error: ratingsErr } = await supabase
          .from('hpc_competency_ratings')
          .upsert(ratingsToUpsert, { onConflict: 'assessment_id,competency_id' });

        if (ratingsErr) throw ratingsErr;
      }

      // 3. Save Parent Reflection if teacher recorded PTM notes & not locked by student/parent portal
      if (!parentData.isParentSubmitted && (parentData.parentComment || parentData.strengthObserved || parentData.areaRequiringSupport)) {
        try {
          await supabase
            .from('hpc_parent_reflections')
            .upsert({
              assessment_id: assessmentId,
              strength_observed: parentData.strengthObserved || null,
              area_requiring_support: parentData.areaRequiringSupport || null,
              interest_talent: parentData.interestTalent || null,
              parent_comment: parentData.parentComment || null,
              submitted_at: new Date().toISOString()
            }, { onConflict: 'assessment_id' });
        } catch (pErr) {
          console.warn('Note: parent reflection table save notice:', pErr);
        }
      }

      // Refresh student list in background to update status badge
      fetchStudents(selectedClass);

      setStatusMessage({
        type: 'success',
        text: targetStatus === 'under_review' 
          ? 'Assessment successfully submitted for review by Principal!' 
          : 'Assessment saved as Draft successfully.'
      });

    } catch (err) {
      console.error('Error saving assessment:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to save assessment: ${err.message || 'Unknown error'}`
      });
    }
    setSaving(false);
  }

  // Organize competencies by Domain
  const organizedDomains = domains.map(domain => {
    // Find competencies mapped to this domain
    const mappedCompIds = domainComps
      .filter(dc => dc.domain_id === domain.id)
      .map(dc => dc.competency_id);

    const domainCompetencies = competencies.filter(c => mappedCompIds.includes(c.id));
    return {
      ...domain,
      competencies: domainCompetencies
    };
  }).filter(d => d.competencies.length > 0);

  // Any unmapped competencies
  const allMappedCompIds = domainComps.map(dc => dc.competency_id);
  const unmappedCompetencies = competencies.filter(c => !allMappedCompIds.includes(c.id));

  // Count evaluated competencies
  const ratedCount = Object.values(teacherRatings).filter(r => r.ratingScaleLevelId).length;
  const totalCompetenciesCount = competencies.length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">360° HPC Assessment Workspace</h1>
          <p className="text-sm text-gray-600 mt-1">
            Conduct holistic evaluations integrating Teacher, Student, Peer, and Parent reflections (NEP 2020)
          </p>
        </div>
        
        {/* Academic Year and Term Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            >
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year_name}</option>
              ))}
            </select>
          </div>

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
        </div>
      </div>
      
      {/* Class Selection & Student Roster */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div className="max-w-md">
          <label className="block text-sm font-semibold text-gray-800 mb-1">Select Class & Section</label>
          <select 
            className="block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm rounded-lg shadow-sm"
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Choose a class to begin assessments --</option>
            {availableClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.section}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p>Loading student roster...</p>
          </div>
        ) : selectedClass ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Student Roster</h2>
                <p className="text-xs text-gray-500">
                  {students.length} students enrolled • Click "Assess" to open evaluation drawer
                </p>
              </div>

              {framework && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                  <BookOpen className="w-3.5 h-3.5" />
                  Framework: {framework.name}
                </span>
              )}
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Roll No</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Student Name</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Assessment Status</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => {
                    // Match assessment for current academic year & selected term
                    const assessment = student.hpc_student_assessments?.find(a => 
                      (!selectedYearId || a.academic_year_id === selectedYearId) &&
                      (!selectedTermId || a.term_id === selectedTermId)
                    );

                    const status = assessment?.status || 'not_started';

                    const statusStyles = {
                      published: 'bg-green-100 text-green-800 border-green-200',
                      approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                      under_review: 'bg-amber-100 text-amber-800 border-amber-200',
                      submitted: 'bg-blue-100 text-blue-800 border-blue-200',
                      draft: 'bg-gray-100 text-gray-800 border-gray-200',
                      returned: 'bg-red-100 text-red-800 border-red-200',
                      not_started: 'bg-slate-100 text-slate-600 border-slate-200'
                    };

                    const statusLabels = {
                      published: 'Published',
                      approved: 'Approved',
                      under_review: 'Under Review',
                      submitted: 'Submitted',
                      draft: 'Draft Saved',
                      returned: 'Returned for Edit',
                      not_started: 'Not Started'
                    };

                    return (
                      <tr key={student.id} className="hover:bg-blue-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                          {student.roll_no || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {formatStudentDisplayName(student.name)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full border ${statusStyles[status] || statusStyles.not_started}`}>
                            {statusLabels[status] || status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <button
                            onClick={() => openAssessmentDrawer(student)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition shadow-sm"
                          >
                            Assess
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <h3 className="text-sm font-semibold text-gray-800">No Class Selected</h3>
            <p className="text-xs text-gray-500 mt-1">Please pick a class from the dropdown above to view students and start evaluating.</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TEACHER ASSESSMENT DRAWER / SLIDE-OVER */}
      {/* ========================================================================= */}
      {isDrawerOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            
            {/* Drawer Top Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg text-white">
                  {selectedStudent.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {formatStudentDisplayName(selectedStudent.name)}
                    <span className="text-xs font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Roll #{selectedStudent.roll_no || '—'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    {availableClasses.find(c => c.id === selectedClass)?.name} {availableClasses.find(c => c.id === selectedClass)?.section} • {terms.find(t => t.id === selectedTermId)?.term_name || 'Term'} ({academicYears.find(y => y.id === selectedYearId)?.year_name})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {currentAssessment?.status && (
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                    currentAssessment.status === 'published' ? 'bg-green-500 text-white' :
                    currentAssessment.status === 'under_review' ? 'bg-amber-500 text-white' :
                    'bg-slate-700 text-slate-200'
                  }`}>
                    {currentAssessment.status}
                  </span>
                )}
                <button
                  onClick={closeAssessmentDrawer}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Close Drawer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {statusMessage && (
              <div className={`px-6 py-3 text-sm flex items-center justify-between ${
                statusMessage.type === 'success' ? 'bg-green-50 text-green-800 border-b border-green-200' : 'bg-red-50 text-red-800 border-b border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span>{statusMessage.text}</span>
                </div>
                <button onClick={() => setStatusMessage(null)} className="text-xs font-bold hover:underline">Dismiss</button>
              </div>
            )}

            {/* Drawer 4 Voices Navigation Tabs */}
            <div className="px-6 bg-slate-100 border-b border-slate-200 flex space-x-1 overflow-x-auto">
              <button
                onClick={() => setDrawerTab('teacher')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                  drawerTab === 'teacher'
                    ? 'border-blue-600 text-blue-600 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                1. Teacher Evaluation
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                  {ratedCount}/{totalCompetenciesCount}
                </span>
              </button>

              <button
                onClick={() => setDrawerTab('student')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                  drawerTab === 'student'
                    ? 'border-amber-500 text-amber-700 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                2. Student Self-Reflection
                {studentSelfRatings.length > 0 && (
                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                    Submitted
                  </span>
                )}
              </button>

              <button
                onClick={() => setDrawerTab('peer')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                  drawerTab === 'peer'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-600" />
                3. Peer Assessment
                {peerData.peerName && (
                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    Recorded
                  </span>
                )}
              </button>

              <button
                onClick={() => setDrawerTab('parent')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                  drawerTab === 'parent'
                    ? 'border-purple-600 text-purple-700 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Heart className="w-4 h-4 text-rose-500" />
                4. Parent Reflection
                {parentData.isParentSubmitted && (
                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                    Submitted
                  </span>
                )}
              </button>
            </div>

            {/* Drawer Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
              {drawerLoading ? (
                <div className="py-16 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p>Loading assessment records and reflections...</p>
                </div>
              ) : (
                <>
                  {/* ========================================================================= */}
                  {/* TAB 1: TEACHER EVALUATION */}
                  {/* ========================================================================= */}
                  {drawerTab === 'teacher' && (
                    <div className="space-y-6">
                      <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-blue-900">NEP 2020 Multi-Domain Assessment</h4>
                          <p className="text-xs text-blue-700 mt-0.5">
                            Evaluate each competency according to the developmental rating scale. Ratings save dynamically as draft.
                          </p>
                        </div>
                      </div>

                      {/* Domain Groups */}
                      {organizedDomains.map(domain => (
                        <div key={domain.id} className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                          <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex justify-between items-center">
                            <div>
                              <h3 className="text-base font-bold text-gray-900">{domain.name}</h3>
                              {domain.description && <p className="text-xs text-gray-500">{domain.description}</p>}
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                              {domain.competencies.length} Competencies
                            </span>
                          </div>

                          <div className="divide-y divide-gray-100">
                            {domain.competencies.map(comp => {
                              const currentRating = teacherRatings[comp.id]?.ratingScaleLevelId;
                              const currentComment = teacherRatings[comp.id]?.comment || '';

                              return (
                                <div key={comp.id} className="p-5 space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <h4 className="text-sm font-bold text-gray-900">{comp.name}</h4>
                                      <span className="inline-block text-[11px] font-semibold text-blue-700 uppercase tracking-wider mt-0.5">
                                        Category: {comp.category}
                                      </span>
                                    </div>
                                    {comp.description && (
                                      <p className="text-xs text-gray-500 max-w-sm">{comp.description}</p>
                                    )}
                                  </div>

                                  {/* Rating Scale Buttons */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Proficiency Level:</label>
                                    <div className="flex flex-wrap gap-2">
                                      {ratingScaleLevels.map(level => {
                                        const isSelected = currentRating === level.id;
                                        return (
                                          <button
                                            key={level.id}
                                            type="button"
                                            onClick={() => handleRatingSelect(comp.id, level.id)}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                                              isSelected
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                          >
                                            <span 
                                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                                              style={{ backgroundColor: level.color_code || '#64748b' }}
                                            />
                                            {level.level_name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Optional Teacher Note for this competency */}
                                  <div>
                                    <input
                                      type="text"
                                      placeholder="Observation note for this competency (optional)..."
                                      value={currentComment}
                                      onChange={(e) => handleCompetencyCommentChange(comp.id, e.target.value)}
                                      className="w-full text-xs px-3 py-2 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Unmapped Competencies fallback */}
                      {unmappedCompetencies.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-base font-bold text-gray-900">General Core Competencies</h3>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {unmappedCompetencies.map(comp => (
                              <div key={comp.id} className="p-5 space-y-3">
                                <h4 className="text-sm font-bold text-gray-900">{comp.name}</h4>
                                <div className="flex flex-wrap gap-2">
                                  {ratingScaleLevels.map(level => {
                                    const isSelected = teacherRatings[comp.id]?.ratingScaleLevelId === level.id;
                                    return (
                                      <button
                                        key={level.id}
                                        type="button"
                                        onClick={() => handleRatingSelect(comp.id, level.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                                          isSelected ? 'bg-slate-900 text-white' : 'bg-white text-gray-700 border-gray-300'
                                        }`}
                                      >
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: level.color_code }} />
                                        {level.level_name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teacher's Holistic Overall Remark */}
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2">
                        <label className="block text-sm font-bold text-gray-900">
                          Teacher's Holistic Remarks & Summary Observation
                        </label>
                        <p className="text-xs text-gray-500">
                          Provide constructive feedback highlighting overall progress, habits, engagement, and focus areas for the upcoming term.
                        </p>
                        <textarea
                          rows={4}
                          value={teacherRemarks}
                          onChange={(e) => setTeacherRemarks(e.target.value)}
                          placeholder="e.g., Shows enthusiastic curiosity in science projects and actively participates in classroom discussions..."
                          className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* TAB 2: STUDENT SELF-REFLECTION */}
                  {/* ========================================================================= */}
                  {drawerTab === 'student' && (
                    <div className="space-y-6">
                      <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">Student's Authentic Voice</h4>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Reflections submitted by the student through the Student Portal. Per NEP 2020 guidelines, student self-evaluations are strictly preserved as their genuine self-assessment.
                          </p>
                        </div>
                      </div>

                      {studentSelfRatings.length > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                          <div className="px-5 py-3 bg-amber-50/40 border-b border-amber-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-amber-900 uppercase">
                              Submitted Self-Assessments ({studentSelfRatings.length})
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              Last updated: {new Date(studentSelfRatings[0]?.submitted_at || studentSelfRatings[0]?.updated_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="divide-y divide-gray-100">
                            {studentSelfRatings.map((sr, idx) => (
                              <div key={idx} className="p-4 space-y-2">
                                <div className="flex justify-between items-center">
                                  <h5 className="text-sm font-bold text-gray-900">
                                    {sr.hpc_competencies?.name || 'Competency Reflection'}
                                  </h5>
                                  {sr.hpc_rating_scale_levels && (
                                    <span 
                                      className="px-2.5 py-1 text-xs font-semibold rounded-full text-white"
                                      style={{ backgroundColor: sr.hpc_rating_scale_levels.color_code || '#f59e0b' }}
                                    >
                                      {sr.hpc_rating_scale_levels.level_name}
                                    </span>
                                  )}
                                </div>
                                {sr.student_comment && (
                                  <p className="text-xs text-gray-700 bg-amber-50/40 p-2.5 rounded-md italic border border-amber-100">
                                    "{sr.student_comment}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center space-y-3">
                          <Sparkles className="w-10 h-10 text-gray-300 mx-auto" />
                          <h4 className="text-sm font-bold text-gray-800">No Online Self-Reflection Submitted Yet</h4>
                          <p className="text-xs text-gray-500 max-w-md mx-auto">
                            The student has not yet submitted their self-reflection via the Student Portal. Once submitted, their reflections will automatically appear here.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* TAB 3: PEER ASSESSMENT */}
                  {/* ========================================================================= */}
                  {drawerTab === 'peer' && (
                    <div className="space-y-6">
                      <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                        <Users className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-emerald-900">Peer Assessment & Social Learning</h4>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Record reflections from collaborative classroom activities, project partners, or desk-buddies.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-5">
                        {/* Peer Selector */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Peer Reviewer (Classmate)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <select
                              value={peerData.peerStudentId}
                              onChange={(e) => {
                                const matched = students.find(s => s.id === e.target.value);
                                setPeerData(prev => ({
                                  ...prev,
                                  peerStudentId: e.target.value,
                                  peerName: matched ? formatStudentDisplayName(matched.name) : prev.peerName
                                }));
                              }}
                              className="text-sm p-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">-- Choose classmate from roster --</option>
                              {students.filter(s => s.id !== selectedStudent.id).map(s => (
                                <option key={s.id} value={s.id}>
                                  {formatStudentDisplayName(s.name)} (Roll #{s.roll_no || '—'})
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              placeholder="Or enter classmate's name..."
                              value={peerData.peerName}
                              onChange={(e) => setPeerData(prev => ({ ...prev, peerName: e.target.value }))}
                              className="text-sm p-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Peer Strengths */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Collaborative Strengths Observed by Peer
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Shares materials, explains math problems clearly, great listener in group work..."
                            value={peerData.strengths}
                            onChange={(e) => setPeerData(prev => ({ ...prev, strengths: e.target.value }))}
                            className="w-full text-sm p-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Peer Feedback Comment */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Positive Peer Feedback / Appreciation Note
                          </label>
                          <textarea
                            rows={3}
                            placeholder="e.g., Working with Aarush during the solar system project was fun because he had great ideas and helped finish our poster on time."
                            value={peerData.comment}
                            onChange={(e) => setPeerData(prev => ({ ...prev, comment: e.target.value }))}
                            className="w-full text-sm p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* TAB 4: PARENT REFLECTION */}
                  {/* ========================================================================= */}
                  {drawerTab === 'parent' && (
                    <div className="space-y-6">
                      <div className="bg-purple-50/80 border border-purple-200 p-4 rounded-xl flex items-start gap-3">
                        <Heart className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-purple-900">Parent's Voice & Home Observations</h4>
                          <p className="text-xs text-purple-700 mt-0.5">
                            Observations from home regarding habits, curiosity, and interests. If parents submit online, their original submission is preserved here. Teachers may also record notes during Parent-Teacher Meetings (PTM).
                          </p>
                        </div>
                      </div>

                      {parentData.isParentSubmitted && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between text-xs text-green-800 font-medium">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Submitted online by Parent via Portal
                          </span>
                          {parentData.submittedAt && (
                            <span>{new Date(parentData.submittedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}

                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Strengths Observed at Home
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Independent reading habits, helpful with siblings, creative storytelling..."
                            value={parentData.strengthObserved}
                            disabled={parentData.isParentSubmitted}
                            onChange={(e) => setParentData(prev => ({ ...prev, strengthObserved: e.target.value }))}
                            className={`w-full text-sm p-2.5 border border-gray-300 rounded-lg text-gray-900 ${
                              parentData.isParentSubmitted ? 'bg-gray-50 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-purple-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Areas Requiring Support or Encouragement
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Needs encouragement in handwriting neatness, time management for homework..."
                            value={parentData.areaRequiringSupport}
                            disabled={parentData.isParentSubmitted}
                            onChange={(e) => setParentData(prev => ({ ...prev, areaRequiringSupport: e.target.value }))}
                            className={`w-full text-sm p-2.5 border border-gray-300 rounded-lg text-gray-900 ${
                              parentData.isParentSubmitted ? 'bg-gray-50 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-purple-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Interests, Hobbies & Talents Outside School
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Playing guitar, swimming, drawing comic strips..."
                            value={parentData.interestTalent}
                            disabled={parentData.isParentSubmitted}
                            onChange={(e) => setParentData(prev => ({ ...prev, interestTalent: e.target.value }))}
                            className={`w-full text-sm p-2.5 border border-gray-300 rounded-lg text-gray-900 ${
                              parentData.isParentSubmitted ? 'bg-gray-50 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-purple-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                            Parent Remarks & Feedback to Class Teacher
                          </label>
                          <textarea
                            rows={3}
                            placeholder="e.g., Appreciate the encouragement provided in mathematics this term..."
                            value={parentData.parentComment}
                            disabled={parentData.isParentSubmitted}
                            onChange={(e) => setParentData(prev => ({ ...prev, parentComment: e.target.value }))}
                            className={`w-full text-sm p-3 border border-gray-300 rounded-lg text-gray-900 ${
                              parentData.isParentSubmitted ? 'bg-gray-50 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-purple-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="text-xs text-gray-500">
                {currentAssessment?.updated_at && (
                  <span>Last saved: {new Date(currentAssessment.updated_at).toLocaleTimeString()}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeAssessmentDrawer}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving || currentAssessment?.status === 'published'}
                  onClick={() => handleSaveAssessment('draft')}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>

                {currentAssessment?.status !== 'published' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveAssessment('under_review')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Review
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
