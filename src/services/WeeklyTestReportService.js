/**
 * WeeklyTestReportService.js
 * Authoritative Server & Workflow Service for:
 * Senior School Consolidated Weekly Test Report & Tuesday Assembly Honours
 * 
 * Implements:
 * - Deterministic, server-authoritative ranking & tie handling via MarksCalculationEngine
 * - Multi-source deduplicated marks aggregation from SubjectMarks & MarksWorkflowService
 * - Safe against missing persistence tables (42P01 relation does not exist)
 * - Strict Class/Section ranking isolation (NO cross-class ranking)
 * - Marks completion tracking across Classes 5–12
 * - Immutable report snapshot storage when tables are present
 * - Non-destructive report versioning (V1, V2 - Revised)
 * - Audit logging
 * - Configurable thresholds and Coordinator integration
 */

import { supabase } from '../lib/supabase';
import { MarksCalculationEngine } from './MarksCalculationEngine';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { getStudentHouse } from '../utils/houseData';
import { getTuesdayAssemblyReleaseDate, getISTDateParts } from '../utils/tuesdayAssemblySchedule';

/**
 * Returns ISO YYYY-MM-DD date string of the upcoming Tuesday Assembly
 */
export function getUpcomingTuesdayDate(date = new Date()) {
  try {
    const rel = getTuesdayAssemblyReleaseDate(date);
    const ist = getISTDateParts(rel);
    return `${ist.year}-${String(ist.month + 1).padStart(2, '0')}-${String(ist.dayOfMonth).padStart(2, '0')}`;
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Check if a PostgreSQL error indicates that an optional table is not yet deployed
 */
function isTableMissingError(error) {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    (typeof error.message === 'string' && error.message.toLowerCase().includes('does not exist')) ||
    (typeof error.details === 'string' && error.details.toLowerCase().includes('does not exist'))
  );
}

export const DEFAULT_WEEKLY_TEST_CONFIG = {
  reporting_enabled: true,
  applicable_classes: [
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12'
  ],
  applicable_sections: [], // empty = all sections
  included_subjects_mode: 'ALL_ASSIGNED',
  required_subjects: [],
  excluded_subjects: [],
  marks_completion_requirement: 'ALL_REQUIRED',
  requires_attention_threshold: 10,
  threshold_type: 'SCORE', // 'SCORE' | 'PERCENTAGE'
  requires_attention_label: 'Requires Attention (Below 10)',
  ranking_policy: 'DENSE', // 'DENSE' (default GN standard) | 'COMPETITION' | 'SHARED'
  exclude_absent_from_ranking: true,
  exclude_na_from_ranking: true,
  coordinator_review_mode: 'EXEMPT', // 'EXEMPT' | 'REQUIRED'
  report_generation_day: 'MONDAY',
  report_generation_time: '08:00',
  school_branding: {
    school_name: 'Gyanoday Niketan',
    section_name: 'Senior School',
    report_title: 'WEEKLY TEST REPORT'
  },
  whatsapp_notification_enabled: true,
  whatsapp_message_template: '🏫 *GYANODAY NIKETAN — WEEKLY TEST REPORT*\n\nThe consolidated Senior School Weekly Test Report for *{{week}}* (Test Date: {{date}}) is now ready in the Principal Portal.\n\nStatus: 🟢 FINAL\nVersion: {{version}}\n\nPlease review it in the Principal Portal prior to Tuesday Morning Assembly.'
};

export class WeeklyTestReportService {
  /**
   * Fetch current system configuration from app_settings
   */
  static async getConfig() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'weekly_test_config')
        .maybeSingle();

      if (error) {
        if (!isTableMissingError(error)) {
          console.warn('Could not fetch weekly_test_config from app_settings:', error.message);
        }
        return { ...DEFAULT_WEEKLY_TEST_CONFIG };
      }

      if (!data || !data.value) {
        return { ...DEFAULT_WEEKLY_TEST_CONFIG };
      }

      return {
        ...DEFAULT_WEEKLY_TEST_CONFIG,
        ...data.value,
        school_branding: {
          ...DEFAULT_WEEKLY_TEST_CONFIG.school_branding,
          ...(data.value.school_branding || {})
        }
      };
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn('Could not fetch weekly_test_config, using defaults:', err.message);
      }
      return { ...DEFAULT_WEEKLY_TEST_CONFIG };
    }
  }

  /**
   * Save configuration updates (Admin / Principal only)
   */
  static async saveConfig(newConfig, user = null) {
    const merged = {
      ...DEFAULT_WEEKLY_TEST_CONFIG,
      ...newConfig
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'weekly_test_config',
        value: merged,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null
      }, { onConflict: 'key' });

    if (error) throw error;

    // Log configuration change audit
    await this.logAudit({
      action: 'CONFIG_CHANGED',
      user,
      new_state: merged,
      reason: 'Admin updated weekly test reporting configuration'
    });

    return merged;
  }

  /**
   * Calculate or locate the weekly test cycle for a given test date
   * Gracefully falls back to virtual cycle if weekly_test_cycles table is not yet deployed
   */
  static async getOrCreateCycle({
    testDate = new Date().toISOString().split('T')[0],
    academicYear = '2026',
    weekIdentifier = null,
    testName = null,
    createdBy = null
  }) {
    const cycleCode = `WT-${testDate}`;

    // Determine week identifier if not passed (e.g. ISO Week)
    let weekId = weekIdentifier;
    if (!weekId) {
      const d = new Date(testDate);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDaysOfYear = (d - startOfYear) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
      weekId = `Week ${weekNum}`;
    }

    const tName = testName || `Senior School Weekly Tuesday Test — ${weekId}`;
    const config = await this.getConfig();

    const virtualCycle = {
      id: `virtual-${cycleCode}`,
      cycle_code: cycleCode,
      academic_year: academicYear,
      test_date: testDate,
      week_identifier: weekId,
      test_name: tName,
      applicable_classes: config.applicable_classes,
      applicable_sections: config.applicable_sections,
      applicable_subjects: config.applicable_subjects,
      status: 'SCHEDULED',
      report_generation_status: 'PENDING',
      current_report_version: 1,
      is_virtual: true
    };

    try {
      // 1. Try to find existing cycle
      const { data: existing, error: fetchErr } = await supabase
        .from('weekly_test_cycles')
        .select('*')
        .eq('cycle_code', cycleCode)
        .maybeSingle();

      if (fetchErr) {
        if (isTableMissingError(fetchErr)) {
          return virtualCycle;
        }
        throw fetchErr;
      }
      if (existing) return existing;

      // Calculate deadline (Monday morning 8:00 AM before Tuesday assembly)
      const testDateObj = new Date(testDate);
      const mondayDeadline = new Date(testDateObj);
      mondayDeadline.setDate(testDateObj.getDate() + 6);
      mondayDeadline.setHours(8, 0, 0, 0);

      const { data: created, error: insertErr } = await supabase
        .from('weekly_test_cycles')
        .insert([{
          cycle_code: cycleCode,
          academic_year: academicYear,
          test_date: testDate,
          week_identifier: weekId,
          test_name: tName,
          applicable_classes: config.applicable_classes,
          applicable_sections: config.applicable_sections,
          applicable_subjects: config.applicable_subjects,
          status: 'SCHEDULED',
          marks_entry_deadline: mondayDeadline.toISOString(),
          report_generation_status: 'PENDING',
          current_report_version: 1,
          created_by: createdBy
        }])
        .select()
        .single();

      if (insertErr) {
        if (isTableMissingError(insertErr)) {
          return virtualCycle;
        }
        // Race condition retry
        const { data: retry } = await supabase
          .from('weekly_test_cycles')
          .select('*')
          .eq('cycle_code', cycleCode)
          .maybeSingle();
        if (retry) return retry;
        throw insertErr;
      }

      await this.logAudit({
        cycle_id: created.id,
        action: 'TEST_CREATED',
        user: { id: createdBy },
        new_state: created,
        reason: `Created Weekly Test cycle for ${testDate} (${weekId})`
      });

      return created;
    } catch (err) {
      if (isTableMissingError(err)) {
        return virtualCycle;
      }
      throw err;
    }
  }

  /**
   * Filter Senior School classes according to configuration
   */
  static filterSeniorSchoolClasses(classes = [], config = null) {
    const applicableClasses = config?.applicable_classes || DEFAULT_WEEKLY_TEST_CONFIG.applicable_classes;
    const applicableSections = config?.applicable_sections || [];

    const normApplicable = applicableClasses.map(c => String(c).trim().toLowerCase());

    return classes.filter(cls => {
      const clsName = String(cls.name || '').trim().toLowerCase();
      // Match by exact name or starts with (e.g. "Class 5", "5", "Class 5A")
      const matchesClass = normApplicable.some(app => 
        clsName === app || 
        clsName.startsWith(app + ' ') || 
        app.startsWith(clsName) ||
        clsName.replace(/^class\s*/i, '') === app.replace(/^class\s*/i, '')
      );

      if (!matchesClass) return false;

      if (applicableSections && applicableSections.length > 0) {
        const sec = String(cls.section || '').trim().toUpperCase();
        return applicableSections.map(s => String(s).trim().toUpperCase()).includes(sec);
      }

      return true;
    }).sort((a, b) => {
      // Sort: 5, 6, 7, 8, 9, 10, 11, 12, then section
      const numA = parseInt(String(a.name).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.name).replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return (a.section || '').localeCompare(b.section || '');
    });
  }

  /**
   * Authoritative compatibility alias for WeeklyTestReportViewer
   */
  static async getCycleCompletionStatus(params = {}) {
    return this.checkMarksCompletion(params);
  }

  /**
   * Track completion status of a weekly test cycle across all classes and subjects
   * Aggregates with strict precedence from:
   * 1. class_subject_mark_submissions + student_marks_detailed (SubjectMarks)
   * 2. weekly_tests + weekly_test_marks
   * 3. public.marks (legacy)
   * Prevents double-counting and uses verified columns only.
   */
  static async checkMarksCompletion({
    cycleId = null,
    academicYear = '2026',
    testDate = null,
    term = 'Finalterm'
  } = {}) {
    const config = await this.getConfig();

    // 1. Fetch Cycle
    let cycle = null;
    if (cycleId && !String(cycleId).startsWith('virtual-')) {
      try {
        const { data, error } = await supabase
          .from('weekly_test_cycles')
          .select('*')
          .eq('id', cycleId)
          .maybeSingle();
        if (error && !isTableMissingError(error)) throw error;
        cycle = data;
      } catch (err) {
        if (!isTableMissingError(err)) throw err;
      }
    }

    if (!cycle) {
      cycle = await this.getOrCreateCycle({
        testDate: testDate || getUpcomingTuesdayDate(),
        academicYear
      });
    }

    // 2. Fetch all Senior School Classes
    const { data: allClasses, error: clsErr } = await supabase
      .from('classes')
      .select('id, name, section, academic_year')
      .eq('academic_year', academicYear);

    if (clsErr) throw clsErr;

    const seniorClasses = this.filterSeniorSchoolClasses(allClasses || [], config);
    const classIds = seniorClasses.map(c => c.id);
    const safeClassIds = classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000'];

    // 3. Fetch active teacher assignments & subjects
    const { data: assignments, error: aErr } = await supabase
      .from('teacher_subjects')
      .select(`
        class_id,
        subject_id,
        teacher_id,
        subjects:subjects(id, name, code)
      `)
      .in('class_id', safeClassIds);

    if (aErr) throw aErr;

    // Fetch teacher profiles separately to prevent foreign key schema cache errors
    const teacherIds = [...new Set((assignments || []).map(a => a.teacher_id).filter(Boolean))];
    const teachersMap = new Map();
    if (teacherIds.length > 0) {
      try {
        const { data: tProfiles } = await supabase
          .from('profiles')
          .select('id, name, role')
          .in('id', teacherIds);
        (tProfiles || []).forEach(p => teachersMap.set(p.id, p));
      } catch (err) {
        console.warn('Notice: Could not load teacher profiles for report:', err.message);
      }
    }

    // 4. Fetch students using ONLY verified existing schema columns (id, class_id, roll_no, name)
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, class_id, roll_no, name')
      .in('class_id', safeClassIds);

    if (stuErr) throw stuErr;

    // 5. FETCH MARKS WITH PRECEDENCE & DEDUPLICATION
    const termVariants = [term];
    if (term === 'Finalterm') termVariants.push('Final-Term', 'Final Term', 'Final_Term');
    if (term === 'Midterm') termVariants.push('Mid-Term', 'Mid Term', 'Mid_Term');

    // Source 1: class_subject_mark_submissions & student_marks_detailed
    let submissions = [];
    try {
      const { data: subData, error: subErr } = await supabase
        .from('class_subject_mark_submissions')
        .select('id, class_id, subject_id, teacher_id, term, status, pattern_id')
        .eq('academic_year', academicYear)
        .in('term', termVariants)
        .in('class_id', safeClassIds);
      if (subErr && !isTableMissingError(subErr)) throw subErr;
      submissions = subData || [];
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    const subIds = submissions.map(s => s.id);
    let detailedMarks = [];
    if (subIds.length > 0) {
      try {
        const { data: dData, error: dErr } = await supabase
          .from('student_marks_detailed')
          .select('id, submission_id, student_id, component_id, raw_score, converted_score, status')
          .in('submission_id', subIds);
        if (dErr && !isTableMissingError(dErr)) throw dErr;
        detailedMarks = dData || [];
      } catch (err) {
        if (!isTableMissingError(err)) throw err;
      }
    }

    // Identify Weekly Test component IDs
    const testCompIds = new Set();
    try {
      const { data: compData, error: cErr } = await supabase
        .from('assessment_components')
        .select('id, component_name, component_code, raw_max_marks, converted_max_marks');
      if (cErr && !isTableMissingError(cErr)) throw cErr;
      if (compData) {
        compData.forEach(c => {
          if (c.component_code === 'TEST' || /weekly.*test|periodic.*test|formative.*test|^test$/i.test(c.component_name || c.name || '')) {
            testCompIds.add(c.id);
          }
        });
      }
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // Source 2: weekly_tests and weekly_test_marks
    let weeklyTests = [];
    let weeklyTestMarks = [];
    try {
      const { data: wtData, error: wtErr } = await supabase
        .from('weekly_tests')
        .select('*')
        .in('class_id', safeClassIds);
      if (wtErr && !isTableMissingError(wtErr)) throw wtErr;
      weeklyTests = wtData || [];

      const wtIds = weeklyTests.map(t => t.id);
      if (wtIds.length > 0) {
        const { data: wtmData, error: wtmErr } = await supabase
          .from('weekly_test_marks')
          .select('*')
          .in('test_id', wtIds);
        if (wtmErr && !isTableMissingError(wtmErr)) throw wtmErr;
        weeklyTestMarks = wtmData || [];
      }
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // Source 3: public.marks legacy
    let legacyMarks = [];
    try {
      const legacyTerms = termVariants.map(t => `${academicYear}_${t}_Test`);
      const { data: lmData, error: lmErr } = await supabase
        .from('marks')
        .select('student_id, subject_id, term, score')
        .in('term', legacyTerms);
      if (lmErr && !isTableMissingError(lmErr)) throw lmErr;
      legacyMarks = lmData || [];
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // Fast lookup index for Source 1
    const subMap = new Map();
    submissions.forEach(s => {
      subMap.set(`${s.class_id}_${s.subject_id}`, s);
    });

    const detailedBySubAndStudent = new Map();
    detailedMarks.forEach(dm => {
      if (testCompIds.size === 0 || testCompIds.has(dm.component_id)) {
        detailedBySubAndStudent.set(`${dm.submission_id}_${dm.student_id}`, dm);
      }
    });

    // Fast lookup index for Source 2
    const wtByClassSub = new Map();
    weeklyTests.forEach(wt => {
      wtByClassSub.set(`${wt.class_id}_${wt.subject_id}`, wt);
    });

    const wtMarksByTestAndStudent = new Map();
    weeklyTestMarks.forEach(m => {
      wtMarksByTestAndStudent.set(`${m.test_id}_${m.student_id}`, m);
    });

    // Fast lookup index for Source 3
    const legacyMarksByStudentSub = new Map();
    legacyMarks.forEach(m => {
      legacyMarksByStudentSub.set(`${m.student_id}_${m.subject_id}`, m.score);
    });

    // Completion Tracker Aggregation
    const classProgress = [];
    const missingSubmissions = [];
    let totalAssignedSubjects = 0;
    let completedAssignedSubjects = 0;
    let subjectsWithMarks = 0;
    let classesWithMarks = 0;
    let totalStudentsEvaluated = 0;
    let totalStudentsAbsent = 0;

    seniorClasses.forEach(cls => {
      const clsStudents = (students || []).filter(s => s.class_id === cls.id);
      const studentCount = clsStudents.length;

      const clsAssignments = (assignments || []).filter(a => a.class_id === cls.id);
      const subjectEntries = [];
      let classHasAnyMarks = false;

      clsAssignments.forEach(assign => {
        totalAssignedSubjects++;
        const subjectObj = assign.subjects || { id: assign.subject_id, name: 'Subject' };
        const teacherProfile = teachersMap.get(assign.teacher_id);
        const teacherObj = teacherProfile || assign.teacher || { id: assign.teacher_id, name: 'Subject Teacher' };
        const classSubKey = `${cls.id}_${assign.subject_id}`;

        const submission = subMap.get(classSubKey);
        const weeklyTest = wtByClassSub.get(classSubKey);

        let enteredCount = 0;
        let absentCount = 0;

        // Iterate through each student in class applying STRICT PRECEDENCE (NO DOUBLE COUNTING)
        clsStudents.forEach(st => {
          let resolved = false;

          // Precedence 1: student_marks_detailed
          if (submission) {
            const dm = detailedBySubAndStudent.get(`${submission.id}_${st.id}`);
            if (dm) {
              if (dm.status === 'ABSENT' || String(dm.raw_score).toUpperCase() === 'A' || String(dm.raw_score).toUpperCase() === 'ABS') {
                absentCount++;
                enteredCount++;
                resolved = true;
              } else if (dm.raw_score !== null && dm.raw_score !== undefined && dm.raw_score !== '') {
                enteredCount++;
                resolved = true;
              }
            }
          }

          // Precedence 2: weekly_test_marks
          if (!resolved && weeklyTest) {
            const wtm = wtMarksByTestAndStudent.get(`${weeklyTest.id}_${st.id}`);
            if (wtm) {
              if (wtm.is_absent) {
                absentCount++;
                enteredCount++;
                resolved = true;
              } else if (wtm.score !== null && wtm.score !== undefined && wtm.score !== '') {
                enteredCount++;
                resolved = true;
              }
            }
          }

          // Precedence 3: legacy public.marks
          if (!resolved) {
            const legScore = legacyMarksByStudentSub.get(`${st.id}_${assign.subject_id}`);
            if (legScore !== undefined && legScore !== null && legScore !== '') {
              const legStr = String(legScore).trim().toUpperCase();
              if (legStr === 'A' || legStr === 'ABS' || legStr === 'ABSENT') {
                absentCount++;
                enteredCount++;
                resolved = true;
              } else {
                enteredCount++;
                resolved = true;
              }
            }
          }
        });

        const pendingCount = Math.max(0, studentCount - enteredCount);

        let status = 'NOT_STARTED'; // 'NOT_STARTED' | 'PENDING' | 'COMPLETE' | 'APPROVED'
        if (enteredCount > 0) {
          classHasAnyMarks = true;
          subjectsWithMarks++;
          if (pendingCount === 0 && studentCount > 0) {
            if (submission?.status === 'APPROVED' || submission?.status === 'LOCKED' || weeklyTest?.status === 'Approved') {
              status = 'COMPLETE';
            } else if (submission?.status === 'SUBMITTED' || weeklyTest?.status === 'Submitted') {
              status = config.coordinator_review_mode === 'REQUIRED' ? 'SUBMITTED_AWAITING_COORDINATOR' : 'COMPLETE';
            } else {
              status = 'PENDING';
            }
          } else {
            status = 'PENDING';
          }
        }

        const isComplete = status === 'COMPLETE' || (pendingCount === 0 && studentCount > 0 && config.coordinator_review_mode === 'EXEMPT');
        if (isComplete) {
          completedAssignedSubjects++;
        }

        totalStudentsEvaluated += (enteredCount - absentCount);
        totalStudentsAbsent += absentCount;

        if (!isComplete) {
          missingSubmissions.push({
            classId: cls.id,
            className: cls.name,
            section: cls.section || '',
            subjectId: assign.subject_id,
            subjectName: subjectObj.name,
            teacherId: assign.teacher_id,
            teacherName: teacherObj.name,
            totalStudents: studentCount,
            enteredCount,
            pendingCount,
            absentCount,
            status
          });
        }

        subjectEntries.push({
          subjectId: assign.subject_id,
          subjectName: subjectObj.name,
          teacherName: teacherObj.name,
          totalStudents: studentCount,
          enteredCount,
          pendingCount,
          absentCount,
          status,
          isComplete,
          submissionId: submission ? submission.id : null,
          testId: weeklyTest ? weeklyTest.id : null
        });
      });

      if (classHasAnyMarks) {
        classesWithMarks++;
      }

      const isClassComplete = subjectEntries.length > 0 && subjectEntries.every(s => s.isComplete);

      classProgress.push({
        classId: cls.id,
        className: cls.name,
        section: cls.section || '',
        totalStudents: studentCount,
        subjects: subjectEntries,
        isClassComplete
      });
    });

    const totalClasses = seniorClasses.length;
    const completedClasses = classProgress.filter(c => c.isClassComplete).length;
    const isDataComplete = totalAssignedSubjects > 0 && missingSubmissions.length === 0;

    return {
      cycle,
      config,
      academicYear,
      term,
      totalClasses,
      completedClasses,
      classesWithMarks,
      totalAssignedSubjects,
      completedAssignedSubjects,
      subjectsWithMarks,
      totalStudentsEvaluated,
      totalStudentsAbsent,
      isDataComplete,
      missingSubmissions,
      classProgress
    };
  }

  /**
   * Authoritative Report Generator (Server/Service Authoritative)
   * 
   * Strict adherence to Architectural Corrections:
   * 1. Multi-source deduplicated marks aggregation from SubjectMarks
   * 2. Distinguishes DATA COMPLETE from FINAL REPORT GENERATED
   * 3. Prevents premature FINAL reports while allowing LIVE progress
   * 4. Enforces strict Class/Section ranking isolation (NO cross-class ranking)
   * 5. Resilient fallback to in-memory virtual report snapshot if weekly_test_reports is missing
   */
  static async generateConsolidatedReport({
    cycleId = null,
    academicYear = '2026',
    testDate = null,
    term = 'Finalterm',
    forceRevision = false,
    revisionReason = '',
    generatedBy = null,
    isMondaySchedule = false
  } = {}) {
    const resolvedTestDate = testDate || getUpcomingTuesdayDate();
    // 1. Audit completion state
    const completion = await this.checkMarksCompletion({ cycleId, academicYear, testDate: resolvedTestDate, term });
    const { cycle, config, isDataComplete, missingSubmissions, classProgress } = completion;

    // 2. Check for existing reports for this cycle (safe against missing table)
    let existingReports = [];
    try {
      const { data, error } = await supabase
        .from('weekly_test_reports')
        .select('*')
        .eq('academic_year', academicYear)
        .eq('test_date', cycle.test_date)
        .order('version', { ascending: false });

      if (error) {
        if (!isTableMissingError(error)) throw error;
      } else {
        existingReports = data || [];
      }
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    const latestReport = existingReports && existingReports.length > 0 ? existingReports[0] : null;

    // 3. Determine Report Status
    const targetStatus = isDataComplete ? 'FINAL' : 'PENDING';

    if (latestReport && latestReport.status === 'FINAL' && targetStatus === 'FINAL' && !forceRevision) {
      return latestReport;
    }

    let newVersion = 1;
    if (latestReport) {
      if (latestReport.status === 'FINAL' && (forceRevision || isDataComplete)) {
        newVersion = latestReport.version + 1;
      } else {
        newVersion = latestReport.version;
      }
    }

    // 4. Fetch raw data across classes with strict deduplication
    const termVariants = [term];
    if (term === 'Finalterm') termVariants.push('Final-Term', 'Final Term', 'Final_Term');
    if (term === 'Midterm') termVariants.push('Mid-Term', 'Mid Term', 'Mid_Term');

    const seniorClasses = this.filterSeniorSchoolClasses(
      (await supabase.from('classes').select('id, name, section, academic_year').eq('academic_year', academicYear)).data || [],
      config
    );
    const classIds = seniorClasses.map(c => c.id);
    const safeClassIds = classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000'];

    // Verified schema columns only
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id, roll_no, name')
      .in('class_id', safeClassIds);

    // Submissions
    let submissions = [];
    try {
      const { data: subData, error: subErr } = await supabase
        .from('class_subject_mark_submissions')
        .select('id, class_id, subject_id, teacher_id, term, status, pattern_id')
        .eq('academic_year', academicYear)
        .in('term', termVariants)
        .in('class_id', safeClassIds);
      if (subErr && !isTableMissingError(subErr)) throw subErr;
      submissions = subData || [];
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    const subIds = submissions.map(s => s.id);
    let detailedMarks = [];
    if (subIds.length > 0) {
      try {
        const { data: dData, error: dErr } = await supabase
          .from('student_marks_detailed')
          .select('id, submission_id, student_id, component_id, raw_score, converted_score, status')
          .in('submission_id', subIds);
        if (dErr && !isTableMissingError(dErr)) throw dErr;
        detailedMarks = dData || [];
      } catch (err) {
        if (!isTableMissingError(err)) throw err;
      }
    }

    // Components
    let testCompIds = new Set();
    try {
      const { data: compData, error: cErr } = await supabase
        .from('assessment_components')
        .select('id, component_name, component_code, raw_max_marks, converted_max_marks');
      if (cErr && !isTableMissingError(cErr)) throw cErr;
      if (compData) {
        compData.forEach(c => {
          if (c.component_code === 'TEST' || /weekly.*test|periodic.*test|formative.*test|^test$/i.test(c.component_name || c.name || '')) {
            testCompIds.add(c.id);
          }
        });
      }
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // Weekly Tests
    let weeklyTests = [];
    let weeklyTestMarks = [];
    try {
      const { data: wtData, error: wtErr } = await supabase
        .from('weekly_tests')
        .select('*')
        .in('class_id', safeClassIds);
      if (wtErr && !isTableMissingError(wtErr)) throw wtErr;
      weeklyTests = wtData || [];

      const wtIds = weeklyTests.map(t => t.id);
      if (wtIds.length > 0) {
        const { data: wtmData, error: wtmErr } = await supabase
          .from('weekly_test_marks')
          .select('*')
          .in('test_id', wtIds);
        if (wtmErr && !isTableMissingError(wtmErr)) throw wtmErr;
        weeklyTestMarks = wtmData || [];
      }
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // Legacy Marks
    let legacyMarks = [];
    try {
      const legacyTerms = termVariants.map(t => `${academicYear}_${t}_Test`);
      const { data: lmData, error: lmErr } = await supabase
        .from('marks')
        .select('student_id, subject_id, term, score')
        .in('term', legacyTerms);
      if (lmErr && !isTableMissingError(lmErr)) throw lmErr;
      legacyMarks = lmData || [];
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // Lookup indexes
    const subMap = new Map();
    submissions.forEach(s => subMap.set(`${s.class_id}_${s.subject_id}`, s));

    const detailedBySubAndStudent = new Map();
    detailedMarks.forEach(dm => {
      if (testCompIds.size === 0 || testCompIds.has(dm.component_id)) {
        detailedBySubAndStudent.set(`${dm.submission_id}_${dm.student_id}`, dm);
      }
    });

    const wtByClassSub = new Map();
    weeklyTests.forEach(wt => wtByClassSub.set(`${wt.class_id}_${wt.subject_id}`, wt));

    const wtMarksByTestAndStudent = new Map();
    weeklyTestMarks.forEach(m => wtMarksByTestAndStudent.set(`${m.test_id}_${m.student_id}`, m));

    const legacyMarksByStudentSub = new Map();
    legacyMarks.forEach(m => legacyMarksByStudentSub.set(`${m.student_id}_${m.subject_id}`, m.score));

    // Calculate Class-by-Class Honours & Details with Section Isolation
    const honoursData = [];
    const requiresAttentionData = [];
    const classDetailsData = [];
    let grandEvaluated = 0;
    let grandAbsent = 0;

    for (const clsProg of classProgress) {
      const fullClassName = `${clsProg.className} ${clsProg.section}`.trim();
      const clsStudents = (students || []).filter(s => s.class_id === clsProg.classId);

      const classStudentMap = new Map();
      clsStudents.forEach(st => {
        classStudentMap.set(st.id, {
          student: st,
          rollNo: st.roll_no,
          name: st.name,
          house: getStudentHouse(st.name, fullClassName),
          subjectScores: {},
          total: 0,
          maxMarks: 0,
          isAbsent: false,
          hasAnyScore: false,
          attemptedSubjects: 0,
          absentSubjects: 0
        });
      });

      // Process each assigned subject
      for (const sub of clsProg.subjects) {
        const classSubKey = `${clsProg.classId}_${sub.subjectId}`;
        const submission = subMap.get(classSubKey);
        const weeklyTest = wtByClassSub.get(classSubKey);

        clsStudents.forEach(st => {
          const stRec = classStudentMap.get(st.id);
          let resolved = false;

          // Precedence 1: student_marks_detailed
          if (submission) {
            const dm = detailedBySubAndStudent.get(`${submission.id}_${st.id}`);
            if (dm) {
              const maxRaw = 25;
              if (dm.status === 'ABSENT' || String(dm.raw_score).toUpperCase() === 'A' || String(dm.raw_score).toUpperCase() === 'ABS') {
                stRec.subjectScores[sub.subjectName] = { score: 0, max: maxRaw, isAbsent: true };
                stRec.attemptedSubjects++;
                stRec.absentSubjects++;
                resolved = true;
              } else if (dm.raw_score !== null && dm.raw_score !== undefined && dm.raw_score !== '') {
                const num = Number(dm.raw_score);
                stRec.total += num;
                stRec.maxMarks += maxRaw;
                stRec.hasAnyScore = true;
                stRec.attemptedSubjects++;
                stRec.subjectScores[sub.subjectName] = { score: num, max: maxRaw, isAbsent: false };
                resolved = true;
              }
            }
          }

          // Precedence 2: weekly_test_marks
          if (!resolved && weeklyTest) {
            const wtm = wtMarksByTestAndStudent.get(`${weeklyTest.id}_${st.id}`);
            if (wtm) {
              const maxRaw = Number(weeklyTest.max_marks || 20);
              if (wtm.is_absent) {
                stRec.subjectScores[sub.subjectName] = { score: 0, max: maxRaw, isAbsent: true };
                stRec.attemptedSubjects++;
                stRec.absentSubjects++;
                resolved = true;
              } else if (wtm.score !== null && wtm.score !== undefined && wtm.score !== '') {
                const num = Number(wtm.score);
                stRec.total += num;
                stRec.maxMarks += maxRaw;
                stRec.hasAnyScore = true;
                stRec.attemptedSubjects++;
                stRec.subjectScores[sub.subjectName] = { score: num, max: maxRaw, isAbsent: false };
                resolved = true;
              }
            }
          }

          // Precedence 3: legacy public.marks
          if (!resolved) {
            const legScore = legacyMarksByStudentSub.get(`${st.id}_${sub.subjectId}`);
            if (legScore !== undefined && legScore !== null && legScore !== '') {
              const maxRaw = 25;
              const legStr = String(legScore).trim().toUpperCase();
              if (legStr === 'A' || legStr === 'ABS' || legStr === 'ABSENT') {
                stRec.subjectScores[sub.subjectName] = { score: 0, max: maxRaw, isAbsent: true };
                stRec.attemptedSubjects++;
                stRec.absentSubjects++;
                resolved = true;
              } else {
                const num = Number(legScore);
                stRec.total += num;
                stRec.maxMarks += maxRaw;
                stRec.hasAnyScore = true;
                stRec.attemptedSubjects++;
                stRec.subjectScores[sub.subjectName] = { score: num, max: maxRaw, isAbsent: false };
                resolved = true;
              }
            }
          }
        });
      }

      // Filter students who have participated in tests
      const evaluatedRoster = Array.from(classStudentMap.values()).filter(s => s.attemptedSubjects > 0);

      evaluatedRoster.forEach(s => {
        if (!s.hasAnyScore && s.absentSubjects > 0) {
          s.isAbsent = true;
          s.percentage = 0;
          grandAbsent++;
        } else {
          s.isAbsent = false;
          s.percentage = s.maxMarks > 0 ? MarksCalculationEngine.applyRounding((s.total / s.maxMarks) * 100, 'ROUND_1_DECIMAL') : 0;
          grandEvaluated++;
        }
      });

      if (evaluatedRoster.length > 0) {
        // Authoritative per-class ranking with dense ties
        const { topScorers, requiresAttention } = MarksCalculationEngine.calculateHonoursAndAttention(evaluatedRoster, {
          rankingPolicy: config.ranking_policy || 'DENSE',
          requiresAttentionThreshold: config.requires_attention_threshold || 10,
          thresholdType: config.threshold_type || 'SCORE',
          excludeAbsentFromRanking: config.exclude_absent_from_ranking ?? true
        });

        honoursData.push({
          classId: clsProg.classId,
          className: clsProg.className,
          section: clsProg.section,
          fullClassName,
          topScorers: topScorers.map(t => ({
            studentId: t.student.id,
            rollNo: t.rollNo,
            name: formatStudentDisplayName(t.name),
            house: t.house,
            total: t.total,
            maxMarks: t.maxMarks,
            percentage: t.percentage,
            rank: t.rank,
            rankDisplay: t.rankDisplay,
            isTie: t.isTie
          }))
        });

        if (requiresAttention.length > 0) {
          requiresAttentionData.push({
            classId: clsProg.classId,
            fullClassName,
            students: requiresAttention.map(r => ({
              studentId: r.student.id,
              rollNo: r.rollNo,
              name: formatStudentDisplayName(r.name),
              house: r.house,
              total: r.total,
              maxMarks: r.maxMarks,
              percentage: r.percentage,
              reason: r.reason
            }))
          });
        }

        classDetailsData.push({
          classId: clsProg.classId,
          fullClassName,
          roster: evaluatedRoster.sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0)).map(s => ({
            studentId: s.student.id,
            rollNo: s.rollNo,
            name: formatStudentDisplayName(s.name),
            house: s.house,
            total: s.total,
            maxMarks: s.maxMarks,
            percentage: s.percentage,
            isAbsent: s.isAbsent,
            subjectScores: s.subjectScores
          }))
        });
      }
    }

    const summaryData = {
      academicYear,
      term,
      weekIdentifier: cycle.week_identifier,
      testDate: cycle.test_date,
      totalClasses: completion.totalClasses,
      completedClasses: completion.completedClasses,
      classesWithMarks: completion.classesWithMarks,
      totalSubjects: completion.totalAssignedSubjects,
      completedSubjects: completion.completedAssignedSubjects,
      subjectsWithMarks: completion.subjectsWithMarks,
      studentsEvaluated: grandEvaluated,
      studentsAbsent: grandAbsent,
      studentsRequiringAttention: requiresAttentionData.reduce((acc, c) => acc + c.students.length, 0),
      isDataComplete,
      generationType: isMondaySchedule ? 'MONDAY_OFFICIAL_SCHEDULE' : 'EXPLICIT_RUN',
      is_live_compilation: true
    };

    const pdfFilename = `Gyanoday_Weekly_Test_Report_${cycle.week_identifier.replace(/\s+/g, '_')}_${academicYear}_V${newVersion}.pdf`;

    const reportPayload = {
      cycle_id: cycle.id,
      academic_year: academicYear,
      term,
      test_date: cycle.test_date,
      week_identifier: cycle.week_identifier,
      version: newVersion,
      status: targetStatus,
      is_current_final: targetStatus === 'FINAL',
      summary_data: summaryData,
      honours_data: honoursData,
      requires_attention_data: requiresAttentionData,
      class_details_data: classDetailsData,
      missing_submissions_data: missingSubmissions,
      config_snapshot: config,
      pdf_filename: pdfFilename,
      generated_by: generatedBy,
      generated_at: new Date().toISOString(),
      revision_reason: revisionReason || (newVersion > 1 ? 'Authorized mark correction' : null)
    };

    // Attempt persistence in weekly_test_reports if table exists
    try {
      if (newVersion > 1) {
        await supabase
          .from('weekly_test_reports')
          .update({ is_current_final: false })
          .eq('cycle_id', cycle.id);
      }

      const { data: savedReport, error: saveErr } = await supabase
        .from('weekly_test_reports')
        .upsert(reportPayload, { onConflict: 'academic_year,cycle_id,version' })
        .select()
        .single();

      if (saveErr) {
        if (!isTableMissingError(saveErr)) throw saveErr;
      } else if (savedReport) {
        // Also update cycle if table exists
        try {
          await supabase
            .from('weekly_test_cycles')
            .update({
              report_generation_status: targetStatus === 'FINAL' ? 'GENERATED' : 'PENDING',
              current_report_version: newVersion,
              report_generated_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', cycle.id);
        } catch (cErr) {
          // ignore if table missing
        }

        await this.logAudit({
          cycle_id: cycle.id,
          report_id: savedReport.id,
          action: newVersion > 1 ? 'REPORT_REVISED' : (targetStatus === 'FINAL' ? 'REPORT_GENERATED' : 'REPORT_CHECK_PENDING'),
          user: { id: generatedBy },
          new_state: { version: newVersion, status: targetStatus, summary: summaryData },
          reason: revisionReason || (targetStatus === 'FINAL' ? 'Generated official consolidated report' : 'Completion check executed; live progress updated')
        });

        return savedReport;
      }
    } catch (err) {
      if (!isTableMissingError(err)) throw err;
    }

    // In-memory virtual report snapshot
    return {
      ...reportPayload,
      id: `virtual-report-${term}-${Date.now()}`
    };
  }

  /**
   * Fetch the latest authoritative FINAL report for the Principal Portal
   */
  static async getLatestFinalReport(academicYear = '2026') {
    try {
      const { data, error } = await supabase
        .from('weekly_test_reports')
        .select('*')
        .eq('academic_year', academicYear)
        .eq('status', 'FINAL')
        .order('test_date', { ascending: false })
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) return null;
        console.warn('getLatestFinalReport notice:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      if (isTableMissingError(err)) return null;
      console.error('getLatestFinalReport error:', err);
      return null;
    }
  }

  /**
   * Fetch report archive with all historical cycles and versions
   */
  static async getReportArchive(academicYear = '2026') {
    try {
      const { data, error } = await supabase
        .from('weekly_test_reports')
        .select(`
          id, cycle_id, academic_year, test_date, week_identifier,
          version, status, is_current_final, summary_data, generated_at,
          pdf_filename, revision_reason
        `)
        .eq('academic_year', academicYear)
        .order('test_date', { ascending: false })
        .order('version', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) return [];
        console.warn('getReportArchive notice:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      if (isTableMissingError(err)) return [];
      console.error('getReportArchive error:', err);
      return [];
    }
  }

  /**
   * Generate concise WhatsApp notification text (secondary action, NO spam)
   */
  static generateWhatsAppNotificationText(report, config = null) {
    if (!report) return '';
    const tmpl = config?.whatsapp_message_template || DEFAULT_WEEKLY_TEST_CONFIG.whatsapp_message_template;
    const week = report.week_identifier || 'Weekly Test';
    const date = report.test_date || '';
    const version = `V${report.version || 1}`;

    return tmpl
      .replace(/{{week}}/g, week)
      .replace(/{{date}}/g, date)
      .replace(/{{version}}/g, version);
  }

  /**
   * Internal audit log helper
   */
  static async logAudit({ cycle_id = null, report_id = null, action, user = null, old_state = null, new_state = null, reason = '' }) {
    try {
      const { error } = await supabase
        .from('weekly_test_audit_logs')
        .insert([{
          cycle_id,
          report_id,
          action,
          user_id: user?.id || null,
          user_role: user?.role || 'system',
          details: { timestamp: new Date().toISOString() },
          old_state,
          new_state,
          reason
        }]);

      if (error && !isTableMissingError(error)) {
        console.warn('weekly_test_audit_logs notice:', error.message);
      }
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn('Could not record weekly_test_audit_logs:', err.message);
      }
    }
  }
}

export default WeeklyTestReportService;
