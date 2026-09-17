/**
 * WeeklyTestReportService.js
 * Authoritative Server & Workflow Service for:
 * Senior School Consolidated Weekly Test Report & Tuesday Assembly Honours
 * 
 * Implements:
 * - Deterministic, server-authoritative ranking & tie handling via MarksCalculationEngine
 * - Marks completion tracking across Classes 5–12
 * - Monday scheduled generation check (distinguishing DATA COMPLETE from FINAL REPORT GENERATED)
 * - Immutable report snapshot storage
 * - Non-destructive report versioning (V1, V2 - Revised)
 * - Audit logging
 * - Configurable thresholds and Coordinator integration
 */

import { supabase } from '../lib/supabase';
import { MarksCalculationEngine } from './MarksCalculationEngine';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { getStudentHouse } from '../utils/houseData';

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

      if (error || !data || !data.value) {
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
      console.warn('Could not fetch weekly_test_config, using defaults:', err.message);
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
   */
  static async getOrCreateCycle({
    testDate = new Date().toISOString().split('T')[0],
    academicYear = '2026',
    weekIdentifier = null,
    testName = null,
    createdBy = null
  }) {
    const cycleCode = `WT-${testDate}`;

    // 1. Try to find existing cycle
    const { data: existing, error: fetchErr } = await supabase
      .from('weekly_test_cycles')
      .select('*')
      .eq('cycle_code', cycleCode)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Weekly test cycle lookup notice:', fetchErr.message);
    }
    if (existing) return existing;

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

    // Calculate deadline (Monday morning 8:00 AM before Tuesday assembly)
    const testDateObj = new Date(testDate);
    // Previous day Monday if test is Tuesday (or 6 days later if test conducted Tuesday)
    const mondayDeadline = new Date(testDateObj);
    mondayDeadline.setDate(testDateObj.getDate() + 6); // next Monday before next Tuesday
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
   * Track completion status of a weekly test cycle across all classes and subjects
   */
  static async checkMarksCompletion({ cycleId, academicYear = '2026', testDate = null }) {
    const config = await this.getConfig();

    // 1. Fetch Cycle
    let cycle = null;
    if (cycleId) {
      const { data } = await supabase
        .from('weekly_test_cycles')
        .select('*')
        .eq('id', cycleId)
        .maybeSingle();
      cycle = data;
    } else if (testDate) {
      cycle = await this.getOrCreateCycle({ testDate, academicYear });
    }

    if (!cycle) {
      throw new Error('Weekly test cycle not found.');
    }

    // 2. Fetch all Senior School Classes
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id, name, section, academic_year')
      .eq('academic_year', academicYear);

    const seniorClasses = this.filterSeniorSchoolClasses(allClasses || [], config);

    // 3. Fetch active teacher assignments & subjects
    const classIds = seniorClasses.map(c => c.id);
    const { data: assignments } = await supabase
      .from('teacher_subjects')
      .select(`
        class_id,
        subject_id,
        teacher_id,
        subjects:subjects(id, name, code),
        teacher:profiles!teacher_id(id, name, role)
      `)
      .in('class_id', classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000']);

    // 4. Fetch all students for Senior School classes
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id, roll_no, name, house, status')
      .in('class_id', classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'Active');

    // 5. Fetch Weekly Tests created for this cycle or date
    const { data: tests } = await supabase
      .from('weekly_tests')
      .select('*')
      .or(`cycle_id.eq.${cycle.id},test_date.eq.${cycle.test_date}`);

    // 6. Fetch marks for all these tests
    const testIds = (tests || []).map(t => t.id);
    let allMarks = [];
    if (testIds.length > 0) {
      const { data: marksData } = await supabase
        .from('weekly_test_marks')
        .select('*')
        .in('test_id', testIds);
      allMarks = marksData || [];
    }

    // Completion Tracker Aggregation
    const classProgress = [];
    const missingSubmissions = [];
    let totalAssignedSubjects = 0;
    let completedAssignedSubjects = 0;
    let totalStudentsEvaluated = 0;
    let totalStudentsAbsent = 0;

    seniorClasses.forEach(cls => {
      const clsStudents = (students || []).filter(s => s.class_id === cls.id);
      const studentCount = clsStudents.length;

      // Find subjects assigned to this class
      const clsAssignments = (assignments || []).filter(a => a.class_id === cls.id);
      const subjectEntries = [];

      clsAssignments.forEach(assign => {
        totalAssignedSubjects++;
        const subjectObj = assign.subjects || { id: assign.subject_id, name: 'Subject' };
        const teacherObj = assign.teacher || { id: assign.teacher_id, name: 'Unassigned Teacher' };

        // Match weekly test row
        const test = (tests || []).find(t => 
          t.class_id === cls.id && 
          t.subject_id === assign.subject_id && 
          (t.cycle_id === cycle.id || t.test_date === cycle.test_date)
        );

        let enteredCount = 0;
        let absentCount = 0;
        let pendingCount = studentCount;
        let status = 'NOT_STARTED'; // 'NOT_STARTED' | 'PENDING' | 'COMPLETE' | 'APPROVED'

        if (test) {
          const testMarks = allMarks.filter(m => m.test_id === test.id);
          absentCount = testMarks.filter(m => m.is_absent).length;
          const scoredCount = testMarks.filter(m => !m.is_absent && m.score !== null && m.score !== undefined && m.score !== '').length;
          enteredCount = scoredCount + absentCount;
          pendingCount = Math.max(0, studentCount - enteredCount);

          if (pendingCount === 0 && studentCount > 0) {
            if (config.coordinator_review_mode === 'REQUIRED') {
              status = test.status === 'Approved' ? 'COMPLETE' : 'SUBMITTED_AWAITING_COORDINATOR';
            } else {
              status = test.status === 'Draft' ? 'PENDING' : 'COMPLETE';
            }
          } else if (enteredCount > 0) {
            status = 'PENDING';
          }
        }

        const isComplete = status === 'COMPLETE';
        if (isComplete) {
          completedAssignedSubjects++;
          totalStudentsEvaluated += (enteredCount - absentCount);
          totalStudentsAbsent += absentCount;
        } else {
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
          testId: test ? test.id : null
        });
      });

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
      totalClasses,
      completedClasses,
      totalAssignedSubjects,
      completedAssignedSubjects,
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
   * 1. Immutable Server Snapshot generated & stored
   * 2. Distinguishes DATA COMPLETE from FINAL REPORT GENERATED
   * 3. Prevents premature FINAL reports on Monday or any day
   * 4. Enforces strict Class/Section ranking isolation (NO cross-class ranking)
   * 5. Preserves V1 and creates V2 on authorized revision
   */
  static async generateConsolidatedReport({
    cycleId,
    academicYear = '2026',
    testDate = null,
    forceRevision = false,
    revisionReason = '',
    generatedBy = null,
    isMondaySchedule = false
  }) {
    // 1. Audit completion state
    const completion = await this.checkMarksCompletion({ cycleId, academicYear, testDate });
    const { cycle, config, isDataComplete, missingSubmissions, classProgress } = completion;

    // 2. Check for existing reports for this cycle
    const { data: existingReports } = await supabase
      .from('weekly_test_reports')
      .select('*')
      .eq('cycle_id', cycle.id)
      .order('version', { ascending: false });

    const latestReport = existingReports && existingReports.length > 0 ? existingReports[0] : null;

    // 3. Determine Report Status
    // CORRECTION #2: A report can ONLY become FINAL when all required marks are complete.
    // If incomplete, it MUST be PENDING.
    const targetStatus = isDataComplete ? 'FINAL' : 'PENDING';

    // If already FINAL, not forcing revision, and data hasn't changed, return existing (Idempotent!)
    if (latestReport && latestReport.status === 'FINAL' && targetStatus === 'FINAL' && !forceRevision) {
      return latestReport;
    }

    // Determine new version
    let newVersion = 1;
    if (latestReport) {
      if (latestReport.status === 'FINAL' && (forceRevision || isDataComplete)) {
        newVersion = latestReport.version + 1;
      } else {
        newVersion = latestReport.version;
      }
    }

    // 4. Calculate Server-Authoritative Class-by-Class Honours & Details
    // CORRECTION #1 & #5: Calculate in server service, strict per-class/section ranking
    const honoursData = [];
    const requiresAttentionData = [];
    const classDetailsData = [];
    let grandEvaluated = 0;
    let grandAbsent = 0;

    // Fetch full test marks for snapshot compilation
    const { data: cycleTests } = await supabase
      .from('weekly_tests')
      .select(`
        id, class_id, subject_id, max_marks, test_date,
        subjects:subjects(id, name),
        classes:classes(id, name, section)
      `)
      .eq('cycle_id', cycle.id);

    const testIds = (cycleTests || []).map(t => t.id);
    let allTestMarks = [];
    if (testIds.length > 0) {
      const { data: mData } = await supabase
        .from('weekly_test_marks')
        .select(`
          id, test_id, student_id, score, is_absent, is_na,
          student:students(id, roll_no, name, house)
        `)
        .in('test_id', testIds);
      allTestMarks = mData || [];
    }

    // Process each class individually
    for (const clsProg of classProgress) {
      const fullClassName = `${clsProg.className} ${clsProg.section}`.trim();
      const classStudentMap = new Map();

      // Collect marks for each subject in this class
      for (const sub of clsProg.subjects) {
        if (!sub.testId) continue;
        const testInfo = (cycleTests || []).find(t => t.id === sub.testId);
        const subMarks = allTestMarks.filter(m => m.test_id === sub.testId);

        subMarks.forEach(m => {
          if (!m.student) return;
          const stId = m.student.id;
          if (!classStudentMap.has(stId)) {
            classStudentMap.set(stId, {
              student: m.student,
              rollNo: m.student.roll_no,
              name: m.student.name,
              house: m.student.house || getStudentHouse(m.student.name, fullClassName),
              subjectScores: {},
              total: 0,
              maxMarks: 0,
              isAbsent: true,
              hasAnyScore: false
            });
          }

          const stRec = classStudentMap.get(stId);
          const maxRaw = Number(testInfo?.max_marks || 25);
          stRec.maxMarks += maxRaw;

          if (m.is_absent) {
            stRec.subjectScores[sub.subjectName] = { score: 0, max: maxRaw, isAbsent: true };
          } else if (m.score !== null && m.score !== undefined && m.score !== '') {
            const numScore = Number(m.score);
            stRec.total += numScore;
            stRec.isAbsent = false;
            stRec.hasAnyScore = true;
            stRec.subjectScores[sub.subjectName] = { score: numScore, max: maxRaw, isAbsent: false };
          }
        });
      }

      const studentRoster = Array.from(classStudentMap.values());

      // If class had marks evaluated, calculate honours & attention via single authoritative engine
      if (studentRoster.length > 0) {
        // Calculate percentage
        studentRoster.forEach(s => {
          s.percentage = s.maxMarks > 0 ? MarksCalculationEngine.applyRounding((s.total / s.maxMarks) * 100, 'ROUND_1_DECIMAL') : 0;
          if (!s.isAbsent) {
            grandEvaluated++;
          } else {
            grandAbsent++;
          }
        });

        // SHARED RANKING ENGINE CALL
        const { topScorers, requiresAttention } = MarksCalculationEngine.calculateHonoursAndAttention(studentRoster, {
          rankingPolicy: config.ranking_policy,
          requiresAttentionThreshold: config.requires_attention_threshold,
          thresholdType: config.threshold_type,
          excludeAbsentFromRanking: config.exclude_absent_from_ranking
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
          roster: studentRoster.sort((a, b) => a.rollNo - b.rollNo).map(s => ({
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
      weekIdentifier: cycle.week_identifier,
      testDate: cycle.test_date,
      totalClasses: completion.totalClasses,
      completedClasses: completion.completedClasses,
      totalSubjects: completion.totalAssignedSubjects,
      completedSubjects: completion.completedAssignedSubjects,
      studentsEvaluated: grandEvaluated,
      studentsAbsent: grandAbsent,
      studentsRequiringAttention: requiresAttentionData.reduce((acc, c) => acc + c.students.length, 0),
      isDataComplete,
      generationType: isMondaySchedule ? 'MONDAY_OFFICIAL_SCHEDULE' : 'EXPLICIT_RUN'
    };

    const pdfFilename = `Gyanoday_Weekly_Test_Report_${cycle.week_identifier.replace(/\s+/g, '_')}_${academicYear}_V${newVersion}.pdf`;

    // 5. Store Immutable Snapshot in weekly_test_reports
    // If previous FINAL existed and we're bumping version, unset its is_current_final
    if (newVersion > 1) {
      await supabase
        .from('weekly_test_reports')
        .update({ is_current_final: false })
        .eq('cycle_id', cycle.id);
    }

    const reportPayload = {
      cycle_id: cycle.id,
      academic_year: academicYear,
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

    const { data: savedReport, error: saveErr } = await supabase
      .from('weekly_test_reports')
      .upsert(reportPayload, { onConflict: 'academic_year,cycle_id,version' })
      .select()
      .single();

    if (saveErr) {
      console.error('Error saving weekly_test_reports snapshot:', saveErr);
      throw saveErr;
    }

    // 6. Update Cycle Status
    await supabase
      .from('weekly_test_cycles')
      .update({
        report_generation_status: targetStatus === 'FINAL' ? 'GENERATED' : 'PENDING',
        current_report_version: newVersion,
        report_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id);

    // 7. Record Audit Log
    await this.logAudit({
      cycle_id: cycle.id,
      report_id: savedReport.id,
      action: newVersion > 1 ? 'REPORT_REVISED' : (targetStatus === 'FINAL' ? 'REPORT_GENERATED' : 'REPORT_CHECK_PENDING'),
      user: { id: generatedBy },
      new_state: { version: newVersion, status: targetStatus, summary: summaryData },
      reason: revisionReason || (targetStatus === 'FINAL' ? 'Generated official consolidated report' : 'Completion check executed; marks pending')
    });

    return savedReport;
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
        console.warn('getLatestFinalReport notice:', error.message);
        return null;
      }
      return data;
    } catch (err) {
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
        console.warn('getReportArchive notice:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
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
      await supabase
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
    } catch (err) {
      console.warn('Could not record weekly_test_audit_logs:', err.message);
    }
  }
}

export default WeeklyTestReportService;
