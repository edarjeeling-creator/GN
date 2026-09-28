import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { MarksWorkflowService } from '../../services/MarksWorkflowService';
import { MarksCalculationEngine } from '../../services/MarksCalculationEngine';
import { formatStudentDisplayName } from '../../utils/studentUtils';
import { getStudentHouse } from '../../utils/houseData';
import { isSixthSubject } from '../../utils/reportUtils';
import { 
  Printer, Lock, AlertTriangle, CheckCircle2, ShieldCheck, 
  Clock, ArrowLeft, RefreshCw, FileText, Download, Layers,
  ChevronRight, Calendar, Trophy, AlertCircle, Frown, MessageCircle,
  Copy, CheckCheck, Sparkles, Share2, Eye
} from 'lucide-react';

export default function ReportPrintingControl({ defaultTab = 'weekly_tests' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { classes, subjects, students, teacherSubjects, marks, academicYear } = useData();

  // Active top-level tab ('weekly_tests' or 'report_cards')
  const initialTab = searchParams.get('tab') || defaultTab || 'weekly_tests';
  const [activeTab, setActiveTab] = useState(initialTab);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // -------------------------------------------------------------
  // WEEKLY TESTS PULDOWN STATE & CONTROLS
  // -------------------------------------------------------------
  const [selectedClassKey, setSelectedClassKey] = useState('');
  const [selectedSubjectKey, setSelectedSubjectKey] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Finalterm'); // 'Finalterm' | 'Midterm'
  const [selectedYear, setSelectedYear] = useState(academicYear || '2026');
  const [selectedFormat, setSelectedFormat] = useState('assembly'); // 'assembly' (1-page podium slip) | 'roster' (full marksheet)
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [detailedMarksMap, setDetailedMarksMap] = useState({});
  const [copiedAssembly, setCopiedAssembly] = useState(false);

  // Helper to normalize class names for grouping sibling sections (e.g. 7A & 7B)
  const getStandardKey = (clsObj) => {
    if (!clsObj) return '';
    let name = String(clsObj.name || '').trim().replace(/^class\s*/i, '').trim();
    if (clsObj.section && name.toLowerCase().endsWith(clsObj.section.toLowerCase())) {
      name = name.slice(0, -clsObj.section.length).trim();
    }
    return name.toLowerCase();
  };

  // Group classes into combined siblings (e.g. 7 A & 7 B) and individual sections
  const classOptions = useMemo(() => {
    if (!classes || !classes.length) return [];
    
    const groups = {};
    classes.forEach(c => {
      const key = getStandardKey(c);
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    const options = [];

    // 1. Add combined sibling options (e.g. 7A & 7B Combined — 1 Page)
    Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a, 10) || 99;
      const numB = parseInt(b, 10) || 99;
      return numA - numB;
    }).forEach(key => {
      const list = groups[key].sort((a, b) => (a.section || '').localeCompare(b.section || ''));
      if (list.length > 1) {
        const label = list.map(c => `${c.name} ${c.section}`.trim()).join(' & ');
        options.push({
          key: `combined_${key}`,
          isCombined: true,
          label: `${label} (Combined) — 1 Page`,
          classes: list
        });
      }
    });

    // 2. Add individual sections
    classes.slice().sort((a, b) => {
      const keyA = getStandardKey(a);
      const keyB = getStandardKey(b);
      const numA = parseInt(keyA, 10) || 99;
      const numB = parseInt(keyB, 10) || 99;
      if (numA !== numB) return numA - numB;
      return (a.section || '').localeCompare(b.section || '');
    }).forEach(c => {
      options.push({
        key: `single_${c.id}`,
        isCombined: false,
        label: `Class ${c.name} ${c.section || ''}`.trim(),
        classes: [c]
      });
    });

    return options;
  }, [classes]);

  // Set default class on load (prefer Class 7 Combined if available)
  useEffect(() => {
    if (!classOptions.length) return;
    if (!selectedClassKey || !classOptions.some(o => o.key === selectedClassKey)) {
      const pref7 = classOptions.find(o => o.key.includes('7') && o.isCombined);
      if (pref7) {
        setSelectedClassKey(pref7.key);
      } else {
        setSelectedClassKey(classOptions[0].key);
      }
    }
  }, [classOptions, selectedClassKey]);

  const selectedClassOption = useMemo(() => {
    return classOptions.find(o => o.key === selectedClassKey) || classOptions[0] || null;
  }, [classOptions, selectedClassKey]);

  // Subject Options for the selected class(es)
  const subjectOptions = useMemo(() => {
    if (!selectedClassOption || !subjects?.length) return [];

    const targetClassIds = selectedClassOption.classes.map(c => c.id);
    const assignedIds = new Set();
    targetClassIds.forEach(cid => {
      (teacherSubjects[cid] || []).forEach(sid => assignedIds.add(sid));
    });

    let relSubjects = subjects.filter(s => assignedIds.has(s.id));
    if (relSubjects.length === 0) {
      relSubjects = subjects;
    }

    const opts = [];

    // Unified 6th Subject group option if any 6th subject elective is present in the school
    const hasSixthSubject = relSubjects.some(s => isSixthSubject(s.name));
    if (hasSixthSubject) {
      opts.push({
        key: 'group_sixth',
        name: '6th Subject (Computer App, Fine Arts, Home Sc, PE, Commercial App)',
        shortName: '6th Subject',
        isSixthGroup: true
      });
    }

    // Individual subjects
    relSubjects.forEach(s => {
      opts.push({
        key: s.id,
        name: s.name,
        shortName: s.name,
        isSixthGroup: false,
        subject: s
      });
    });

    return opts;
  }, [selectedClassOption, teacherSubjects, subjects]);

  // Set default subject when subject options change
  useEffect(() => {
    if (!subjectOptions.length) return;
    if (!selectedSubjectKey || !subjectOptions.some(o => o.key === selectedSubjectKey)) {
      setSelectedSubjectKey(subjectOptions[0].key);
    }
  }, [subjectOptions, selectedSubjectKey]);

  const selectedSubjectOption = useMemo(() => {
    return subjectOptions.find(o => o.key === selectedSubjectKey) || subjectOptions[0] || null;
  }, [subjectOptions, selectedSubjectKey]);

  // Display name for the subject
  const subjectDisplayName = useMemo(() => {
    if (!selectedSubjectOption) return 'Subject';
    return selectedSubjectOption.shortName || selectedSubjectOption.name;
  }, [selectedSubjectOption]);

  // Load detailed marks from class_subject_mark_submissions & student_marks_detailed
  const loadDetailedMarks = async () => {
    if (!selectedClassOption) return;
    setLoadingMarks(true);
    try {
      const classIds = selectedClassOption.classes.map(c => c.id);
      const map = {};

      let subjectIdsToQuery = [];
      if (selectedSubjectKey === 'group_sixth') {
        subjectIdsToQuery = subjects.filter(s => isSixthSubject(s.name)).map(s => s.id);
      } else if (selectedSubjectKey) {
        subjectIdsToQuery = [selectedSubjectKey];
      }

      if (subjectIdsToQuery.length > 0) {
        const { data: subs } = await supabase
          .from('class_subject_mark_submissions')
          .select('id, class_id, subject_id')
          .in('class_id', classIds)
          .in('subject_id', subjectIdsToQuery)
          .eq('academic_year', selectedYear)
          .eq('term', selectedTerm);

        if (subs && subs.length > 0) {
          const subIds = subs.map(s => s.id);
          const { data: details } = await supabase
            .from('student_marks_detailed')
            .select('submission_id, student_id, raw_score, status, component_id, assessment_components(component_code)')
            .in('submission_id', subIds);

          if (details) {
            details.forEach(d => {
              const subObj = subs.find(s => s.id === d.submission_id);
              if (subObj) {
                const compCode = d.assessment_components?.component_code || '';
                if (compCode.includes('TEST') || compCode === 'WT' || !compCode) {
                  map[`${d.student_id}_${subObj.subject_id}`] = d.raw_score;
                }
              }
            });
          }
        }
      }

      setDetailedMarksMap(map);
    } catch (err) {
      console.warn('Notice loading detailed marks in ReportPrintingControl:', err);
    } finally {
      setLoadingMarks(false);
    }
  };

  useEffect(() => {
    loadDetailedMarks();
  }, [selectedClassOption, selectedSubjectKey, selectedYear, selectedTerm]);

  // Helper to extract student mark for the active subject / 6th subject group
  const getStudentMark = (student, targetSubjectKey, academicYr, termStr) => {
    if (targetSubjectKey === 'group_sixth') {
      const sixthSubs = subjects.filter(s => isSixthSubject(s.name));
      for (const sub of sixthSubs) {
        const detailVal = detailedMarksMap[`${student.id}_${sub.id}`];
        if (detailVal !== undefined && detailVal !== null && detailVal !== '') {
          return { score: Number(detailVal), subjectName: sub.name, isAbsent: false };
        }
        const legacyKey = `${student.id}_${sub.id}_${academicYr}_${termStr}_Test`;
        const mVal = marks[legacyKey];
        if (mVal !== undefined && mVal !== null && mVal !== '') {
          return { score: Number(mVal), subjectName: sub.name, isAbsent: false };
        }
      }
      return null;
    }

    const detailVal = detailedMarksMap[`${student.id}_${targetSubjectKey}`];
    if (detailVal !== undefined && detailVal !== null && detailVal !== '') {
      return { score: Number(detailVal), subjectName: selectedSubjectOption?.name, isAbsent: false };
    }
    const legacyKey = `${student.id}_${targetSubjectKey}_${academicYr}_${termStr}_Test`;
    const mVal = marks[legacyKey];
    if (mVal !== undefined && mVal !== null && mVal !== '') {
      return { score: Number(mVal), subjectName: selectedSubjectOption?.name, isAbsent: false };
    }
    return null;
  };

  // Compute live honours and attention for all sections in the selected class option
  const sectionDataList = useMemo(() => {
    if (!selectedClassOption || !students?.length) return [];

    return selectedClassOption.classes.map(secCls => {
      const secStudents = students
        .filter(s => s.class_id === secCls.id || s.classId === secCls.id)
        .sort((a, b) => a.roll_no - b.roll_no);

      const scoredStudents = secStudents.map(student => {
        const markObj = getStudentMark(student, selectedSubjectKey, selectedYear, selectedTerm);
        if (!markObj) return null;

        const house = student.house || getStudentHouse(student.name, `${secCls.name} ${secCls.section}`);
        return {
          student,
          total: markObj.score,
          isAbsent: markObj.isAbsent || false,
          house,
          subjectDetail: selectedSubjectKey === 'group_sixth' ? markObj.subjectName : null
        };
      }).filter(Boolean);

      const summary = MarksCalculationEngine.calculateHonoursAndAttention(scoredStudents, {
        rankingPolicy: 'DENSE',
        requiresAttentionThreshold: 10,
        thresholdType: 'SCORE',
        excludeAbsentFromRanking: true
      });

      return {
        cls: secCls,
        allStudents: secStudents,
        scoredStudents,
        summary
      };
    });
  }, [selectedClassOption, students, detailedMarksMap, marks, selectedSubjectKey, selectedYear, selectedTerm, subjects]);

  // House badge styling
  const getHouseBadgeColor = (house) => {
    switch ((house || '').toLowerCase()) {
      case 'garnet': return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
      case 'topaz': return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      case 'turquoise': return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
      case 'onyx': return 'bg-slate-900/90 text-slate-200 border-slate-600/50';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getHousePrintBadge = (house) => {
    switch ((house || '').toLowerCase()) {
      case 'garnet': return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'topaz': return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'turquoise': return 'bg-cyan-50 text-cyan-800 border-cyan-300';
      case 'onyx': return 'bg-slate-100 text-slate-800 border-slate-400';
      default: return 'bg-slate-50 text-slate-700 border-slate-300';
    }
  };

  // WhatsApp and Clipboard Actions
  const handleCopyAssembly = () => {
    if (!selectedClassOption) return;
    const lines = [];
    lines.push(`*GYANODAY NIKETAN — TUESDAY ASSEMBLY HONOURS*`);
    lines.push(`*Class:* ${selectedClassOption.label}`);
    lines.push(`*Subject:* ${subjectDisplayName}`);
    lines.push(`*Term:* ${selectedTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} ${selectedYear}`);
    lines.push('');

    sectionDataList.forEach(({ cls: secCls, summary: secSummary }) => {
      lines.push(`*CLASS: ${secCls.name} ${secCls.section || ''}*`);
      lines.push(`*🏆 Top Scorers (Assembly Honours):*`);
      if (secSummary.topScorers.length === 0) {
        lines.push(`_No marks recorded yet._`);
      } else {
        secSummary.topScorers.forEach(s => {
          const houseText = s.house ? ` (${s.house})` : '';
          const subNote = s.subjectDetail ? ` [${s.subjectDetail}]` : '';
          lines.push(`• *${s.rankDisplay}*: ${formatStudentDisplayName(s.student.name)}${houseText}${subNote} — *${s.total}*`);
        });
      }
      lines.push('');
      lines.push(`*⚠️ Requires Attention (Below 10):*`);
      if (secSummary.requiresAttention.length === 0) {
        lines.push(`✓ All evaluated students scored ≥ 10.`);
      } else {
        secSummary.requiresAttention.forEach(s => {
          const houseText = s.house ? ` (${s.house})` : '';
          const subNote = s.subjectDetail ? ` [${s.subjectDetail}]` : '';
          lines.push(`• ${formatStudentDisplayName(s.student.name)}${houseText}${subNote} — *${s.total}*`);
        });
      }
      lines.push('');
    });

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAssembly(true);
    setTimeout(() => setCopiedAssembly(false), 2500);
  };

  const handleWhatsAppPrincipal = () => {
    if (!selectedClassOption) return;
    const lines = [];
    lines.push(`*GYANODAY NIKETAN — TUESDAY ASSEMBLY HONOURS*`);
    lines.push(`*Class:* ${selectedClassOption.label}`);
    lines.push(`*Subject:* ${subjectDisplayName}`);
    lines.push(`*Term:* ${selectedTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} ${selectedYear}`);
    lines.push('');

    sectionDataList.forEach(({ cls: secCls, summary: secSummary }) => {
      lines.push(`*CLASS: ${secCls.name} ${secCls.section || ''}*`);
      lines.push(`*🏆 Top Scorers (Assembly Honours):*`);
      if (secSummary.topScorers.length === 0) {
        lines.push(`_No marks recorded yet._`);
      } else {
        secSummary.topScorers.forEach(s => {
          const houseText = s.house ? ` (${s.house})` : '';
          const subNote = s.subjectDetail ? ` [${s.subjectDetail}]` : '';
          lines.push(`• *${s.rankDisplay}*: ${formatStudentDisplayName(s.student.name)}${houseText}${subNote} — *${s.total}*`);
        });
      }
      lines.push('');
      lines.push(`*⚠️ Requires Attention (Below 10):*`);
      if (secSummary.requiresAttention.length === 0) {
        lines.push(`✓ All evaluated students scored ≥ 10.`);
      } else {
        secSummary.requiresAttention.forEach(s => {
          const houseText = s.house ? ` (${s.house})` : '';
          const subNote = s.subjectDetail ? ` [${s.subjectDetail}]` : '';
          lines.push(`• ${formatStudentDisplayName(s.student.name)}${houseText}${subNote} — *${s.total}*`);
        });
      }
      lines.push('');
    });

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Safe print trigger that temporarily removes dark mode to guarantee pure white background
  const triggerSafePrint = () => {
    const wasDark = document.documentElement.classList.contains('dark');
    const prevBg = document.documentElement.style.getPropertyValue('--bg-color');
    document.documentElement.style.setProperty('--bg-color', '#ffffff');
    document.documentElement.style.backgroundColor = '#ffffff';
    document.body.style.backgroundColor = '#ffffff';
    if (wasDark) {
      document.documentElement.classList.remove('dark');
    }

    const restoreDark = () => {
      document.documentElement.style.setProperty('--bg-color', prevBg || '');
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      if (wasDark && !document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.add('dark');
      }
    };

    window.addEventListener('afterprint', restoreDark, { once: true });

    setTimeout(() => {
      window.print();
      setTimeout(restoreDark, 1000);
    }, 150);
  };

  // -------------------------------------------------------------
  // REPORT CARDS GATEKEEPER STATE & LOGIC
  // -------------------------------------------------------------
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [classReadiness, setClassReadiness] = useState([]);
  const [printLogs, setPrintLogs] = useState([]);

  const loadClassReadiness = async () => {
    setLoadingReadiness(true);
    try {
      const results = [];
      for (const cls of classes || []) {
        const check = await MarksWorkflowService.verifyReportReadiness({
          classId: cls.id,
          academicYear: selectedYear,
          term: selectedTerm
        });

        results.push({
          classId: cls.id,
          className: cls.name,
          section: cls.section || 'A',
          isReady: check.isReady,
          totalSubjects: check.totalSubjects,
          lockedSubjects: check.lockedSubjects,
          pendingCount: check.pendingSubjectsCount,
          unlockedSubjects: check.unlockedSubjects || []
        });
      }

      setClassReadiness(results);

      const { data: logs } = await supabase
        .from('report_print_logs')
        .select(`
          *,
          classes(name, section),
          profiles:printed_by(name, role)
        `)
        .eq('academic_year', selectedYear)
        .eq('term', selectedTerm)
        .order('printed_at', { ascending: false });

      setPrintLogs(logs || []);
    } catch (err) {
      console.error('Error verifying class readiness:', err);
    } finally {
      setLoadingReadiness(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'report_cards' && classes && classes.length > 0) {
      loadClassReadiness();
    }
  }, [activeTab, classes, selectedYear, selectedTerm]);

  const handlePrintOfficial = async (item) => {
    if (!item.isReady) {
      alert(`Cannot print official report cards: ${item.pendingCount} subject(s) are not yet approved and locked by Coordinator.`);
      return;
    }

    try {
      const existingForClass = printLogs.filter(l => l.class_id === item.classId);
      const versionNumber = existingForClass.length + 1;
      const reportVersion = `${selectedTerm.toUpperCase()}-${selectedYear}-V${versionNumber}`;

      await MarksWorkflowService.logPrintEvent({
        classId: item.classId,
        academicYear: selectedYear,
        term: selectedTerm,
        reportVersion,
        studentCount: item.totalStudents || 0,
        notes: `Official batch report cards printed by ${profile?.name || 'Coordinator'}`
      });

      navigate(`/classes/${item.classId}/reports?official=true&version=${reportVersion}`);
    } catch (err) {
      alert('Printing blocked: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/coordinator/marks')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-2 transition cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Coordinator Control Room
          </button>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Download size={18} />
            <span>Download & Print Center</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Weekly Tests & Report Printing Hub
          </h1>
          <p className="text-sm text-slate-300 mt-0.5">
            Select weekly test slips or batch terminal reports from pulldown menus and print in one go.
          </p>
        </div>

        {/* Top-Level Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => switchTab('weekly_tests')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'weekly_tests'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText size={15} />
            <span>Weekly Tests</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab('report_cards')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'report_cards'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck size={15} />
            <span>Report Cards Gatekeeper</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: WEEKLY TESTS PULDOWN & 1-PAGE PRINT SLIP */}
      {/* ========================================================= */}
      {activeTab === 'weekly_tests' && (
        <div className="space-y-6">
          {/* Interactive Pulldown Filter Bar (no-print) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 no-print">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider">
                <Sparkles size={16} />
                <span>Pulldown Menu Selection</span>
              </div>
              <div className="text-xs text-slate-400">
                💡 Paper Saving: Sibling sections (e.g. 7A & 7B) automatically print onto <strong>1 single A4 sheet</strong> for the Principal.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Class / Section Pulldown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  1. Class / Section
                </label>
                <select
                  value={selectedClassKey}
                  onChange={e => setSelectedClassKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  {classOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Subject Pulldown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Subject
                </label>
                <select
                  value={selectedSubjectKey}
                  onChange={e => setSelectedSubjectKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  {subjectOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Term Pulldown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  3. Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="Finalterm">Final-Term Weekly Test</option>
                  <option value="Midterm">Mid-Term Weekly Test</option>
                </select>
              </div>

              {/* 4. Academic Year Pulldown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  4. Academic Year
                </label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="2026">Academic Year 2026-27</option>
                  <option value="2025">Academic Year 2025-26</option>
                </select>
              </div>

              {/* 5. Format Pulldown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  5. Format / Layout
                </label>
                <select
                  value={selectedFormat}
                  onChange={e => setSelectedFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="assembly">Tuesday Assembly Slip (1-Page)</option>
                  <option value="roster">Full Marksheet Roster</option>
                </select>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={triggerSafePrint}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-md shadow-indigo-950/40 border border-indigo-400/40 active:scale-95 cursor-pointer"
                  title="Print paper-saver slip directly on 1 page for Principal"
                >
                  <Printer size={15} />
                  <span>Print Slip ({selectedClassOption?.isCombined ? 'Both Sections — 1 Page' : '1 Page'})</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppPrincipal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-sm border border-emerald-500/40 active:scale-95 cursor-pointer"
                  title="Open WhatsApp with pre-formatted assembly honours text"
                >
                  <MessageCircle size={15} />
                  <span>WhatsApp to Principal</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAssembly}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer active:scale-95 ${
                    copiedAssembly 
                      ? 'bg-emerald-900/60 text-emerald-300 border-emerald-500/50' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Copy formatted markdown text to clipboard"
                >
                  {copiedAssembly ? <CheckCheck size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  <span>{copiedAssembly ? 'Copied to Clipboard!' : 'Copy Briefing'}</span>
                </button>

                <button
                  type="button"
                  onClick={loadDetailedMarks}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Refresh marks from server"
                >
                  <RefreshCw size={14} className={loadingMarks ? 'animate-spin' : ''} />
                  <span>Refresh Marks</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active: <strong>{selectedClassOption?.label}</strong> • <strong>{subjectDisplayName}</strong></span>
              </div>
            </div>
          </div>

          {/* On-Screen Live Preview matching exact A4 printed slip (no-print) */}
          <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Eye size={17} className="text-indigo-400" />
                <span>On-Screen Live Preview</span>
              </div>
              <span className="text-xs text-slate-400">
                {selectedFormat === 'assembly' ? 'Podium Slip Format' : 'Full Marksheet Roster'}
              </span>
            </div>

            {/* Live Preview Display Container */}
            {selectedFormat === 'assembly' ? (
              <div className="space-y-6">
                {sectionDataList.map(({ cls: secCls, summary: secSummary }) => (
                  <div key={secCls.id} className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Class: {secCls.name} {secCls.section}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Subject: {subjectDisplayName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {secSummary.topScorers.length} Honours Rankers • {secSummary.requiresAttention.length} Below 10
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Top Scorers */}
                      <div className="rounded-xl border border-emerald-500/30 bg-slate-900/90 overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wide">
                            <Trophy size={14} className="text-emerald-400" />
                            <span>Top Scorers (Assembly Honours)</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            {secSummary.topScorers.length} Student{secSummary.topScorers.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="p-0 divide-y divide-slate-800 max-h-60 overflow-y-auto">
                          {secSummary.topScorers.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                              No marks entered yet for this section.
                            </div>
                          ) : (
                            secSummary.topScorers.map(s => (
                              <div key={s.student.id} className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-850/60">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white shrink-0 ${
                                    s.rank === 1 ? 'bg-yellow-500' : s.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'
                                  }`}>
                                    {s.rank}
                                  </div>
                                  <span className="font-bold text-xs text-white truncate max-w-[160px]">
                                    {formatStudentDisplayName(s.student.name)}
                                  </span>
                                  {s.house && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${getHouseBadgeColor(s.house)}`}>
                                      {s.house}
                                    </span>
                                  )}
                                  {s.subjectDetail && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                                      {s.subjectDetail}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono font-black text-sm text-emerald-400 shrink-0">
                                  {s.total}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Requires Attention */}
                      <div className="rounded-xl border border-rose-500/30 bg-slate-900/90 overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wide">
                            <AlertCircle size={14} className="text-rose-400" />
                            <span>Requires Attention (Below 10)</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950 px-2 py-0.5 rounded-full border border-rose-500/30">
                            {secSummary.requiresAttention.length} Student{secSummary.requiresAttention.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="p-0 divide-y divide-slate-800 max-h-60 overflow-y-auto">
                          {secSummary.requiresAttention.length === 0 ? (
                            <div className="p-4 text-center text-xs text-emerald-400">
                              ✓ All evaluated students scored ≥ 10.
                            </div>
                          ) : (
                            secSummary.requiresAttention.map(s => (
                              <div key={s.student.id} className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-850/60">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Frown size={14} className="text-slate-400 shrink-0" />
                                  <span className="font-bold text-xs text-slate-200 truncate max-w-[160px]">
                                    {formatStudentDisplayName(s.student.name)}
                                  </span>
                                  {s.house && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${getHouseBadgeColor(s.house)}`}>
                                      {s.house}
                                    </span>
                                  )}
                                  {s.subjectDetail && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                                      {s.subjectDetail}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono font-black text-sm text-rose-400 shrink-0">
                                  {s.total}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Full Marksheet Roster Format */
              <div className="space-y-6">
                {sectionDataList.map(({ cls: secCls, scoredStudents }) => (
                  <div key={secCls.id} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="font-bold text-xs text-white">
                        Class: {secCls.name} {secCls.section} — {subjectDisplayName}
                      </span>
                      <span className="text-xs text-slate-400">
                        {scoredStudents.length} Students Evaluated
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-200">
                        <thead className="bg-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Roll</th>
                            <th className="py-2 px-3">Student Name</th>
                            <th className="py-2 px-3">House</th>
                            {selectedSubjectKey === 'group_sixth' && <th className="py-2 px-3">Elective</th>}
                            <th className="py-2 px-3 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {scoredStudents.map(({ student, total, house, subjectDetail }) => (
                            <tr key={student.id} className="hover:bg-slate-900/60">
                              <td className="py-2 px-3 font-mono">{student.roll_no}</td>
                              <td className="py-2 px-3 font-semibold">{formatStudentDisplayName(student.name)}</td>
                              <td className="py-2 px-3">
                                {house && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${getHouseBadgeColor(house)}`}>
                                    {house}
                                  </span>
                                )}
                              </td>
                              {selectedSubjectKey === 'group_sixth' && (
                                <td className="py-2 px-3 text-purple-300 font-medium">{subjectDetail || '-'}</td>
                              )}
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* PRINT-ONLY PODIUM SLIP (Guaranteed 100% 1-Page on Paper) */}
          {/* ========================================================= */}
          <div 
            id="print-weekly-test-slip" 
            className="hidden print:block font-sans text-black bg-white"
            style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}
          >
            <style>{`
              @page {
                margin: 6mm 8mm 6mm 8mm !important;
                size: portrait;
              }
              @media print {
                :root, :root.dark {
                  --bg-color: #ffffff !important;
                }
                *, *::before, *::after {
                  color-scheme: light !important;
                  box-shadow: none !important;
                  text-shadow: none !important;
                }
                html, html.dark, body, body.dark, #root, .app, .app-layout, .main-content, .layout-content-container, .max-w-7xl, #print-weekly-test-slip, .print-page-boundary {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  background-color: #ffffff !important;
                  color: #000000 !important;
                  border: none !important;
                  box-shadow: none !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .no-print {
                  display: none !important;
                }
                .print-page-boundary {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  width: 100% !important;
                  min-height: 280mm !important;
                  box-sizing: border-box !important;
                  background: #ffffff !important;
                  background-color: #ffffff !important;
                  color: #000000 !important;
                }
              }
            `}</style>

            <div 
              className="print-page-boundary p-1 bg-white"
              style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}
            >
              {/* Header */}
              <div className="text-center border-b-2 border-black pb-1 mb-1.5">
                <h1 className="text-lg font-black uppercase tracking-wider font-serif text-black">GYANODAY NIKETAN</h1>
                <h2 className="text-xs font-black uppercase tracking-wide text-black mt-0.5">
                  Tuesday Morning Assembly Honours & Attention Slip
                </h2>
                <div className="flex justify-center items-center gap-3 text-[10px] font-bold mt-1 text-black flex-wrap">
                  <span><strong>Class:</strong> {selectedClassOption?.label}</span>
                  <span>•</span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-black text-black"><strong>Subject:</strong> {subjectDisplayName}</span>
                  <span>•</span>
                  <span><strong>Term:</strong> {selectedTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} {selectedYear}</span>
                  <span>•</span>
                  <span><strong>Faculty:</strong> {profile?.name || 'Staff Member'}</span>
                </div>
              </div>

              {/* Sections List */}
              <div className="space-y-2">
                {sectionDataList.map(({ cls: secCls, summary: secSummary }) => (
                  <div key={secCls.id} className="border border-black rounded p-1.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                    {/* Section Sub-header */}
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-black">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[11px] uppercase tracking-wider text-black bg-white px-2 py-0.5 rounded border border-black">
                          Class: {secCls.name} {secCls.section}
                        </span>
                        <span className="font-bold text-[10px] uppercase tracking-wide text-black bg-white px-2 py-0.5 rounded border border-black">
                          Subject: {subjectDisplayName}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-black">
                        {secSummary.topScorers.length} Honours Rankers • {secSummary.requiresAttention.length} Below 10
                      </span>
                    </div>

                    {/* 2-Column Grid: Top Scorers & Requires Attention */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Left: Top Scorers */}
                      <div className="border border-black rounded p-1.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                        <h3 className="font-black text-[10px] uppercase tracking-wider pb-0.5 border-b border-black text-black mb-1 flex items-center justify-between">
                          <span>🏆 Top Scorers (Assembly Honours)</span>
                        </h3>
                        {secSummary.topScorers.length === 0 ? (
                          <p className="text-[9px] italic text-slate-600 py-0.5">No marks entered yet</p>
                        ) : (
                          <table className="w-full text-[9px] leading-tight">
                            <thead>
                              <tr className="border-b border-black text-black font-bold text-[8.5px]">
                                <th className="py-0.5 text-left w-6">Rank</th>
                                <th className="py-0.5 text-left">Student Name</th>
                                <th className="py-0.5 text-left w-16">House</th>
                                {selectedSubjectKey === 'group_sixth' && <th className="py-0.5 text-left w-20">Elective</th>}
                                <th className="py-0.5 text-right w-10">Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {secSummary.topScorers.map((s, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-0.5 font-black text-black">
                                    <span className={`inline-block px-1 py-0.2 rounded text-[8px] font-black ${
                                      s.rank === 1 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                      s.rank === 2 ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                                      'bg-orange-50 text-orange-900 border border-orange-200'
                                    }`}>
                                      {s.rankDisplay}
                                    </span>
                                  </td>
                                  <td className="py-0.5 font-bold text-black truncate max-w-[130px]">
                                    {formatStudentDisplayName(s.student.name)}
                                  </td>
                                  <td className="py-0.5">
                                    {s.house && (
                                      <span className={`inline-block px-1 py-0.2 rounded text-[7.5px] font-semibold border ${getHousePrintBadge(s.house)}`}>
                                        {s.house}
                                      </span>
                                    )}
                                  </td>
                                  {selectedSubjectKey === 'group_sixth' && (
                                    <td className="py-0.5 text-[8px] text-purple-900 font-semibold truncate max-w-[90px]">
                                      {s.subjectDetail || '-'}
                                    </td>
                                  )}
                                  <td className="py-0.5 font-mono font-black text-right text-black">
                                    {s.total}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Right: Requires Attention */}
                      <div className="border border-black rounded p-1.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                        <h3 className="font-black text-[10px] uppercase tracking-wider pb-0.5 border-b border-black text-black mb-1 flex items-center justify-between">
                          <span>⚠️ Requires Attention (Below 10)</span>
                        </h3>
                        {secSummary.requiresAttention.length === 0 ? (
                          <p className="text-[9px] font-medium text-emerald-800 py-0.5">✓ All evaluated students scored ≥ 10.</p>
                        ) : (
                          <table className="w-full text-[9px] leading-tight">
                            <thead>
                              <tr className="border-b border-black text-black font-bold text-[8.5px]">
                                <th className="py-0.5 text-left">Student Name</th>
                                <th className="py-0.5 text-left w-16">House</th>
                                {selectedSubjectKey === 'group_sixth' && <th className="py-0.5 text-left w-20">Elective</th>}
                                <th className="py-0.5 text-right w-10">Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {secSummary.requiresAttention.map((s, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-0.5 font-bold text-black truncate max-w-[140px]">
                                    {formatStudentDisplayName(s.student.name)}
                                  </td>
                                  <td className="py-0.5">
                                    {s.house && (
                                      <span className={`inline-block px-1 py-0.2 rounded text-[7.5px] font-semibold border ${getHousePrintBadge(s.house)}`}>
                                        {s.house}
                                      </span>
                                    )}
                                  </td>
                                  {selectedSubjectKey === 'group_sixth' && (
                                    <td className="py-0.5 text-[8px] text-purple-900 font-semibold truncate max-w-[90px]">
                                      {s.subjectDetail || '-'}
                                    </td>
                                  )}
                                  <td className="py-0.5 font-mono font-black text-right text-rose-800">
                                    {s.total}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compact Footer with Signatures */}
              <div className="mt-2 pt-1 border-t border-black flex justify-between items-end text-[9px] text-black">
                <div className="space-y-0.5">
                  <p className="text-black font-medium">Printed from Gyanoday Niketan Download & Print Center</p>
                  <p className="text-[8px] text-slate-600 font-mono">
                    Official Academic Briefing • Generated on {new Date().toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div className="flex gap-10 text-center">
                  <div>
                    <div className="w-24 border-b border-black mb-1"></div>
                    <span className="font-bold text-[8.5px] uppercase text-black">Subject Teacher</span>
                  </div>
                  <div>
                    <div className="w-24 border-b border-black mb-1"></div>
                    <span className="font-bold text-[8.5px] uppercase text-black">Principal / Coordinator</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TERMINAL REPORT CARDS GATEKEEPER & CONTROLS */}
      {/* ========================================================= */}
      {activeTab === 'report_cards' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="2026">Academic Year 2026-27</option>
                <option value="2025">Academic Year 2025-26</option>
              </select>

              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="Midterm">Mid-Term Examination</option>
                <option value="Finalterm">Final-Term Examination</option>
              </select>

              <button
                onClick={loadClassReadiness}
                className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw size={15} className={loadingReadiness ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Report card printing is locked until 100% of subject marks are verified and approved by Coordinator.
            </div>
          </div>

          {/* Class Gatekeeper Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classReadiness.map(item => (
              <div
                key={item.classId}
                className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                  item.isReady
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
                    : 'bg-slate-900 border-slate-800 shadow-sm'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {item.className}
                      </h2>
                      <span className="text-xs text-slate-400 font-medium">Section {item.section}</span>
                    </div>

                    {item.isReady ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 size={13} /> READY TO PRINT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <Lock size={13} /> LOCKED GATE
                      </span>
                    )}
                  </div>

                  {/* Progress Indicator */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-300">
                      <span>Subject Lock Completion:</span>
                      <span className="font-bold text-white">
                        {item.lockedSubjects} / {item.totalSubjects} Subjects
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                      <div
                        className={`h-full transition-all duration-500 ${
                          item.isReady ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{
                          width: `${item.totalSubjects > 0 ? (item.lockedSubjects / item.totalSubjects) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Status Message / Pending Subjects List */}
                  {item.isReady ? (
                    <div className="text-xs bg-emerald-900/30 text-emerald-200 p-3 rounded-xl border border-emerald-500/30 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                      <span>All required subjects approved and locked by Coordinator.</span>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs bg-amber-950/40 p-3 rounded-xl border border-amber-500/30 text-amber-200">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                        <span>Awaiting Coordinator Approval — {item.pendingCount} subject(s) pending</span>
                      </div>
                      {item.unlockedSubjects.length > 0 && (
                        <ul className="pl-4 list-disc text-slate-300 space-y-0.5">
                          {item.unlockedSubjects.slice(0, 4).map((sub, i) => (
                            <li key={i}>
                              <span className="font-medium text-white">{sub.subjectName}</span> ({sub.status})
                            </li>
                          ))}
                          {item.unlockedSubjects.length > 4 && (
                            <li className="text-slate-400 italic">
                              +{item.unlockedSubjects.length - 4} more pending subjects...
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/classes/${item.classId}/flowsheet`)}
                    className="text-xs font-semibold text-slate-400 hover:text-indigo-400 transition cursor-pointer"
                  >
                    View Flowsheet
                  </button>

                  {item.isReady ? (
                    <button
                      onClick={() => handlePrintOfficial(item)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Print Official Reports</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                      title="Printing blocked until all subjects are locked"
                    >
                      <Lock size={14} />
                      <span>Printing Locked</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Official Print History Audit Trail */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <FileText size={18} className="text-indigo-400" />
                <span>Permanent Report Card Print History & Versioning</span>
              </div>
              <div className="text-xs text-slate-400">
                Audit-logged record of all generated batch report cards
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 border-b border-slate-700 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 text-slate-200 font-bold">Class</th>
                    <th className="py-3 px-4 text-slate-200 font-bold">Term & Year</th>
                    <th className="py-3 px-4 text-slate-200 font-bold">Report Version</th>
                    <th className="py-3 px-4 text-slate-200 font-bold">Printed By</th>
                    <th className="py-3 px-4 text-slate-200 font-bold">Timestamp</th>
                    <th className="py-3 px-4 text-slate-200 font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {printLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-medium">
                        No official report card print events recorded for this term.
                      </td>
                    </tr>
                  ) : (
                    printLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">
                          {log.classes?.name} {log.classes?.section}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {log.term} ({log.academic_year})
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                          {log.report_version}
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          {log.profiles?.name || 'Administrator'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(log.printed_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic">
                          {log.notes || 'Official Batch Print'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
