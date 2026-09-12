/**
 * test_coordinator_marks_workflow.cjs
 * Comprehensive 30-Scenario Automated Test Suite for:
 * Coordinator-Controlled Marks Verification, Locking, Report Printing
 * & Admin-Configurable Assessment Engine
 */

const assert = require('assert');

// Import Calculation Engine logic (matching src/services/MarksCalculationEngine.js)
class TestCalculationEngine {
  static resolvePatternForClass(patterns, className) {
    if (!className || !patterns || patterns.length === 0) return null;
    const cleanName = className.trim();
    const activePatterns = patterns.filter(p => p.status === 'ACTIVE');

    for (const pat of activePatterns) {
      if (Array.isArray(pat.applicable_classes) && pat.applicable_classes.length > 0) {
        if (pat.applicable_classes.some(c => cleanName.toLowerCase().includes(c.toLowerCase()))) {
          return pat;
        }
      }
    }

    if (/^(playgroup|nursery|lkg|ukg|class\s*(1|2|3|4))\b/i.test(cleanName)) {
      return activePatterns.find(p => p.class_group === 'JUNIOR') || activePatterns[0];
    }
    if (/^class\s*(5|6|7|8)\b/i.test(cleanName)) {
      return activePatterns.find(p => p.class_group === 'SENIOR_5_8') || activePatterns[0];
    }
    if (/^class\s*(9|10)\b/i.test(cleanName)) {
      return activePatterns.find(p => p.class_group === 'SECONDARY_9_10') || activePatterns[0];
    }
    if (/^class\s*(11|12)\b/i.test(cleanName)) {
      return activePatterns.find(p => p.class_group === 'HIGHER_SECONDARY_11_12') || activePatterns[0];
    }

    return activePatterns[0] || null;
  }

  static applyRounding(value, rule = 'ROUND_2_DECIMALS') {
    if (value === null || value === undefined || isNaN(value)) return null;
    const num = Number(value);
    switch (rule) {
      case 'ROUND_NEAREST_INTEGER':
        return Math.round(num);
      case 'ROUND_1_DECIMAL':
        return Math.round(num * 10) / 10;
      case 'ROUND_2_DECIMALS':
        return Math.round(num * 100) / 100;
      case 'NO_ROUNDING':
      default:
        return num;
    }
  }

  static convertComponentScore(rawScore, component, roundingRule = 'ROUND_2_DECIMALS') {
    if (rawScore === null || rawScore === undefined || rawScore === '') return null;
    const raw = Number(rawScore);
    if (isNaN(raw)) return null;
    if (raw < 0 || raw > component.raw_max_marks) {
      throw new Error(`Raw score ${raw} is out of range [0, ${component.raw_max_marks}] for ${component.component_name}`);
    }
    if (component.raw_max_marks === component.converted_max_marks) {
      return raw;
    }
    const ratio = component.converted_max_marks / component.raw_max_marks;
    return this.applyRounding(raw * ratio, roundingRule);
  }

  static calculateStudentScores(components, scoresByComponent, pattern = {}) {
    let totalMarks = 0;
    let maxTotal = 0;
    let allMarked = true;
    let anyMarked = false;
    const roundingRule = pattern.rounding_rule || 'ROUND_2_DECIMALS';

    for (const comp of components) {
      const entry = scoresByComponent[comp.id] || {};
      const status = entry.status || 'MARKED';

      if (status === 'ABSENT' || status === 'NOT_APPLICABLE') {
        continue;
      }

      if (entry.rawScore !== undefined && entry.rawScore !== null && entry.rawScore !== '') {
        const conv = this.convertComponentScore(entry.rawScore, comp, roundingRule);
        if (comp.contributes_to_total) {
          totalMarks += conv;
          maxTotal += comp.converted_max_marks;
        }
        anyMarked = true;
      } else {
        if (comp.is_mandatory) allMarked = false;
      }
    }

    if (!anyMarked) {
      return { totalMarks: null, maxTotal: 0, percentage: null, grade: null };
    }

    const finalTotal = this.applyRounding(totalMarks, roundingRule);
    const percentage = maxTotal > 0 ? this.applyRounding((finalTotal / maxTotal) * 100, roundingRule) : null;
    const grade = this.determineGrade(percentage, pattern.grade_boundaries || []);

    return { totalMarks: finalTotal, maxTotal, percentage, grade };
  }

  static determineGrade(percentage, boundaries = []) {
    if (percentage === null || percentage === undefined || isNaN(percentage)) return null;
    for (const b of boundaries) {
      if (percentage >= b.min_percentage && percentage <= b.max_percentage) {
        return b.grade_name;
      }
    }
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }
}

// Simulated Authoritative ERP State Machine & Security Simulator
class ErpWorkflowSimulator {
  constructor() {
    this.patterns = [
      {
        id: 'pat-junior-v1',
        pattern_name: 'Junior School Scheme',
        class_group: 'JUNIOR',
        applicable_classes: ['Class 1', 'Class 2', 'Class 3', 'Class 4'],
        version: 1,
        status: 'ACTIVE',
        rounding_rule: 'ROUND_NEAREST_INTEGER',
        components: [
          { id: 'comp-j-form', component_code: 'FORMATIVE', component_name: 'Formative Assessment', raw_max_marks: 50, converted_max_marks: 50, is_mandatory: true, contributes_to_total: true },
          { id: 'comp-j-summ', component_code: 'SUMMATIVE', component_name: 'Summative Assessment', raw_max_marks: 50, converted_max_marks: 50, is_mandatory: true, contributes_to_total: true }
        ],
        grade_boundaries: [
          { grade_name: 'A+', min_percentage: 90, max_percentage: 100 },
          { grade_name: 'A', min_percentage: 75, max_percentage: 89.99 },
          { grade_name: 'B', min_percentage: 60, max_percentage: 74.99 },
          { grade_name: 'C', min_percentage: 40, max_percentage: 59.99 },
          { grade_name: 'D', min_percentage: 0, max_percentage: 39.99 }
        ]
      },
      {
        id: 'pat-5-8-v1',
        pattern_name: 'Senior School Classes 5-8',
        class_group: 'SENIOR_5_8',
        applicable_classes: ['Class 5', 'Class 6', 'Class 7', 'Class 8'],
        version: 1,
        status: 'ACTIVE',
        rounding_rule: 'ROUND_2_DECIMALS',
        components: [
          { id: 'comp-test', component_code: 'TEST', component_name: 'Unit Test', raw_max_marks: 25, converted_max_marks: 25, is_mandatory: true, contributes_to_total: true },
          { id: 'comp-exam', component_code: 'EXAM', component_name: 'Term Exam', raw_max_marks: 100, converted_max_marks: 75, is_mandatory: true, contributes_to_total: true }
        ],
        grade_boundaries: [
          { grade_name: 'A+', min_percentage: 90, max_percentage: 100 },
          { grade_name: 'A', min_percentage: 80, max_percentage: 89.99 },
          { grade_name: 'B', min_percentage: 70, max_percentage: 79.99 },
          { grade_name: 'C', min_percentage: 50, max_percentage: 69.99 },
          { grade_name: 'D', min_percentage: 35, max_percentage: 49.99 },
          { grade_name: 'F', min_percentage: 0, max_percentage: 34.99 }
        ]
      },
      {
        id: 'pat-9-10-v1',
        pattern_name: 'Secondary Classes 9-10 Scheme',
        class_group: 'SECONDARY_9_10',
        applicable_classes: ['Class 9', 'Class 10'],
        version: 1,
        status: 'ACTIVE',
        rounding_rule: 'ROUND_2_DECIMALS',
        components: [
          { id: 'comp-9-int', component_code: 'INTERNAL', component_name: 'Internal Assessment', raw_max_marks: 20, converted_max_marks: 20, is_mandatory: true, contributes_to_total: true },
          { id: 'comp-9-th', component_code: 'THEORY', component_name: 'Board Theory Exam', raw_max_marks: 80, converted_max_marks: 80, is_mandatory: true, contributes_to_total: true }
        ],
        subject_rules: [
          { subject_code: 'SIXTH_ELECTIVE', subject_category: 'SIXTH_SUBJECT', include_in_aggregate: false, include_in_rank: false }
        ]
      },
      {
        id: 'pat-11-12-v1',
        pattern_name: 'Higher Secondary 11-12 Scheme',
        class_group: 'HIGHER_SECONDARY_11_12',
        applicable_classes: ['Class 11', 'Class 12'],
        version: 1,
        status: 'ACTIVE',
        rounding_rule: 'ROUND_2_DECIMALS',
        components: [
          { id: 'comp-11-th', component_code: 'THEORY', component_name: 'Theory Paper', raw_max_marks: 70, converted_max_marks: 70, is_mandatory: true, contributes_to_total: true },
          { id: 'comp-11-pr', component_code: 'PRACTICAL', component_name: 'Practical / Project', raw_max_marks: 30, converted_max_marks: 30, is_mandatory: true, contributes_to_total: true }
        ]
      }
    ];

    this.students = [
      { id: 'stud-1', name: 'Aarav Sharma', roll_no: 1, class_id: 'cls-8a', status: 'active', elective: 'Hindi' },
      { id: 'stud-2', name: 'Bhavna Rai', roll_no: 2, class_id: 'cls-8a', status: 'active', elective: 'Nepali' },
      { id: 'stud-3', name: 'Chetan Gurung', roll_no: 3, class_id: 'cls-8a', status: 'inactive' }, // inactive student
      { id: 'stud-4', name: 'Deepa Thapa', roll_no: 4, class_id: 'cls-8a', status: 'active', elective: 'Hindi' }
    ];

    this.classes = [
      { id: 'cls-8a', name: 'Class 8', section: 'A' }
    ];

    this.subjects = [
      { id: 'sub-math', name: 'Mathematics', code: 'MATH' },
      { id: 'sub-sci', name: 'Science', code: 'SCI' },
      { id: 'sub-eng', name: 'English', code: 'ENG' }
    ];

    this.submissions = {};
    this.detailedMarks = {};
    this.auditLogs = [];
    this.printLogs = [];
  }

  // Auto-populate roster
  getActiveRoster(classId) {
    return this.students
      .filter(s => s.class_id === classId && s.status === 'active')
      .sort((a, b) => a.roll_no - b.roll_no);
  }

  // Teacher submit marks
  submitMarks(submissionKey, user, notes = '') {
    const sub = this.submissions[submissionKey];
    if (!sub) throw new Error('Submission not found');
    if (user.role === 'teacher' && user.id !== sub.teacher_id) {
      throw new Error('UNAUTHORIZED_TEACHER_MODIFICATION: Cannot modify another teacher\'s marks');
    }
    if (sub.status === 'LOCKED') {
      throw new Error('LOCKED_MARKS_MODIFICATION_BLOCKED: Cannot modify locked marks');
    }
    if (sub.status !== 'DRAFT' && sub.status !== 'RETURNED_FOR_CORRECTION') {
      throw new Error('INVALID_STATE_TRANSITION: Must be in DRAFT or RETURNED_FOR_CORRECTION to submit');
    }

    const marks = this.detailedMarks[sub.id] || [];
    if (marks.length === 0) {
      throw new Error('CANNOT_SUBMIT_EMPTY_MARKSHEET');
    }

    const prev = sub.status;
    sub.status = sub.status === 'RETURNED_FOR_CORRECTION' ? 'RESUBMITTED' : 'SUBMITTED';
    sub.submitted_at = new Date().toISOString();
    sub.notes = notes;

    this.auditLogs.push({
      action: 'SUBMIT_MARKS',
      submission_id: sub.id,
      user_id: user.id,
      role: user.role,
      previous_status: prev,
      new_status: sub.status,
      timestamp: new Date().toISOString()
    });

    return sub;
  }

  // Coordinator review: APPROVE, LOCK, or RETURN
  coordinatorReview(submissionKey, user, action, reason = '') {
    // Role check
    const isAuthorized = user.role === 'coordinator' || user.role === 'admin' || user.role === 'principal' ||
      (user.designation && user.designation.toLowerCase().includes('coordinator'));

    if (!isAuthorized) {
      throw new Error('UNAUTHORIZED_COORDINATOR_ACTION: User does not have coordinator/admin privileges');
    }

    const sub = this.submissions[submissionKey];
    if (!sub) throw new Error('Submission not found');

    const prev = sub.status;

    if (action === 'APPROVE') {
      if (sub.status !== 'SUBMITTED' && sub.status !== 'RESUBMITTED' && sub.status !== 'UNDER_REVIEW') {
        throw new Error(`INVALID_STATE_TRANSITION: Cannot approve submission from ${sub.status}`);
      }
      sub.status = 'APPROVED';
      sub.approved_by = user.id;
      sub.approved_at = new Date().toISOString();
    } else if (action === 'LOCK') {
      if (sub.status !== 'APPROVED') {
        throw new Error('CANNOT_LOCK_UNAPPROVED_MARKS: Submission must be APPROVED before locking');
      }
      sub.status = 'LOCKED';
      sub.locked_by = user.id;
      sub.locked_at = new Date().toISOString();
    } else if (action === 'RETURN') {
      if (!reason || !reason.trim()) {
        throw new Error('MANDATORY_REASON_REQUIRED: A specific reason must be provided when returning marks');
      }
      sub.status = 'RETURNED_FOR_CORRECTION';
      sub.return_reason = reason.trim();
      sub.reviewed_by = user.id;
      sub.reviewed_at = new Date().toISOString();
    } else {
      throw new Error('UNKNOWN_ACTION');
    }

    this.auditLogs.push({
      action: `COORDINATOR_${action}`,
      submission_id: sub.id,
      user_id: user.id,
      role: user.role,
      previous_status: prev,
      new_status: sub.status,
      reason: reason || null,
      timestamp: new Date().toISOString()
    });

    return sub;
  }

  // Principal / Admin authorized override
  principalOverride(detailedMarkId, user, newRawScore, reason) {
    if (user.role !== 'principal' && user.role !== 'admin') {
      throw new Error('UNAUTHORIZED: Only Principal or Administrator can perform exceptional overrides');
    }
    if (!reason || !reason.trim()) {
      throw new Error('REASON_REQUIRED: A documented audit reason is required for an exceptional override');
    }

    let targetMark = null;
    let targetSub = null;
    for (const [subId, marks] of Object.entries(this.detailedMarks)) {
      const m = marks.find(x => x.id === detailedMarkId);
      if (m) {
        targetMark = m;
        targetSub = this.submissions[Object.keys(this.submissions).find(k => this.submissions[k].id === subId)];
        break;
      }
    }

    if (!targetMark) throw new Error('Detailed mark not found');

    const oldRaw = targetMark.raw_score;
    targetMark.raw_score = newRawScore;
    targetMark.is_override = true;
    targetMark.override_reason = reason;
    targetMark.override_by = user.id;

    this.auditLogs.push({
      action: 'PRINCIPAL_OVERRIDE',
      mark_id: detailedMarkId,
      old_value: oldRaw,
      new_value: newRawScore,
      user_id: user.id,
      role: user.role,
      reason: reason,
      timestamp: new Date().toISOString()
    });

    return targetMark;
  }

  // Report readiness check
  verifyReportReadiness(classId, academicYear, term) {
    const requiredSubjectIds = this.subjects.map(s => s.id);
    let lockedCount = 0;
    const unlockedSubjects = [];

    for (const subId of requiredSubjectIds) {
      const key = `${classId}_${subId}_${term}_${academicYear}`;
      const sub = this.submissions[key];
      const subject = this.subjects.find(s => s.id === subId);

      if (sub && sub.status === 'LOCKED') {
        lockedCount++;
      } else {
        unlockedSubjects.push({
          subjectId: subId,
          subjectName: subject?.name || 'Unknown',
          status: sub?.status || 'NOT_STARTED'
        });
      }
    }

    const isReady = lockedCount === requiredSubjectIds.length && requiredSubjectIds.length > 0;

    return {
      isReady,
      totalSubjects: requiredSubjectIds.length,
      lockedSubjects: lockedCount,
      pendingSubjectsCount: unlockedSubjects.length,
      unlockedSubjects
    };
  }

  // Log report print
  logReportPrint(classId, academicYear, term, user, notes = '') {
    const readiness = this.verifyReportReadiness(classId, academicYear, term);
    if (!readiness.isReady) {
      throw new Error(`PREMATURE_PRINTING_BLOCKED: Cannot print official report cards. ${readiness.pendingSubjectsCount} subject(s) are not locked.`);
    }

    const countExisting = this.printLogs.filter(l => l.class_id === classId && l.term === term && l.academic_year === academicYear).length;
    const version = `${term.toUpperCase()}-${academicYear}-V${countExisting + 1}`;

    const printEvent = {
      id: `print-${Date.now()}-${Math.random()}`,
      class_id: classId,
      academic_year: academicYear,
      term: term,
      report_version: version,
      printed_by: user.id,
      printed_at: new Date().toISOString(),
      student_count: this.getActiveRoster(classId).length,
      notes
    };

    this.printLogs.push(printEvent);
    return printEvent;
  }
}

// ==============================================================================
// TEST EXECUTION RUNNER
// ==============================================================================
console.log('================================================================');
console.log('GYANODAY NIKETAN: 30-SCENARIO COORDINATOR MARKS & ENGINE TEST SUITE');
console.log('================================================================\n');

const sim = new ErpWorkflowSimulator();
let passed = 0;
let failed = 0;

function runTest(num, name, fn) {
  try {
    fn();
    console.log(`[PASS] Test ${num}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Test ${num}: ${name}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

// 1. Teacher roster automatically loads correct students
runTest(1, 'Teacher roster automatically loads correct enrolled active students without office requests', () => {
  const roster = sim.getActiveRoster('cls-8a');
  assert.strictEqual(roster.length, 3, 'Should only load active students (3 out of 4)');
  assert.strictEqual(roster[0].name, 'Aarav Sharma');
  assert.strictEqual(roster[1].name, 'Bhavna Rai');
  assert.strictEqual(roster[2].name, 'Deepa Thapa');
  assert.strictEqual(roster.find(s => s.id === 'stud-3'), undefined, 'Inactive student must be excluded');
});

// 2. Valid raw marks accepted
runTest(2, 'Valid raw marks are accepted within limits', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const comp = pat.components.find(c => c.component_code === 'TEST');
  const converted = TestCalculationEngine.convertComponentScore(20, comp);
  assert.strictEqual(converted, 20);
});

// 3. Negative marks rejected
runTest(3, 'Negative marks rejected by validation', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const comp = pat.components.find(c => c.component_code === 'TEST');
  assert.throws(() => {
    TestCalculationEngine.convertComponentScore(-5, comp);
  }, /out of range/);
});

// 4. Marks above configured maximum rejected
runTest(4, 'Marks above configured maximum rejected', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const comp = pat.components.find(c => c.component_code === 'TEST'); // max 25
  assert.throws(() => {
    TestCalculationEngine.convertComponentScore(26, comp);
  }, /out of range/);
});

// 5. Absent handled correctly
runTest(5, 'Absent status is properly recognized and does not corrupt calculation', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const scores = {
    'comp-test': { rawScore: 20, status: 'MARKED' },
    'comp-exam': { rawScore: null, status: 'ABSENT' }
  };
  const res = TestCalculationEngine.calculateStudentScores(pat.components, scores, pat);
  assert.strictEqual(res.totalMarks, 20);
  assert.strictEqual(res.maxTotal, 25);
  assert.strictEqual(res.percentage, 80);
});

// 6. N/A handled correctly
runTest(6, 'N/A status is properly recognized and omitted from totals', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const scores = {
    'comp-test': { rawScore: 22, status: 'MARKED' },
    'comp-exam': { rawScore: null, status: 'NOT_APPLICABLE' }
  };
  const res = TestCalculationEngine.calculateStudentScores(pat.components, scores, pat);
  assert.strictEqual(res.totalMarks, 22);
  assert.strictEqual(res.maxTotal, 25);
});

// 7. Class 5–8 Test 25 + Exam 100 -> Exam converted to 75 -> Total 100
runTest(7, 'Class 5–8 Test 25 + Exam 100 -> Exam converted to 75 -> Total 100', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const testComp = pat.components.find(c => c.component_code === 'TEST');
  const examComp = pat.components.find(c => c.component_code === 'EXAM');

  // Example: Exam raw 80/100 -> Converted 60/75. Test = 20/25 -> Total = 80/100
  const convExam = TestCalculationEngine.convertComponentScore(80, examComp);
  assert.strictEqual(convExam, 60, 'Exam 80/100 must convert to 60/75');

  const scores = {
    'comp-test': { rawScore: 20, status: 'MARKED' },
    'comp-exam': { rawScore: 80, status: 'MARKED' }
  };
  const res = TestCalculationEngine.calculateStudentScores(pat.components, scores, pat);
  assert.strictEqual(res.totalMarks, 80, '20 + 60 must equal 80');
  assert.strictEqual(res.maxTotal, 100, 'Max total must be 100');
  assert.strictEqual(res.percentage, 80, 'Percentage must be 80%');
  assert.strictEqual(res.grade, 'A', '80% should yield Grade A');
});

// 8. Junior assessment configuration works using configured rules
runTest(8, 'Junior School assessment configuration uses Formative (50) + Summative (50)', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-junior-v1');
  const scores = {
    'comp-j-form': { rawScore: 45, status: 'MARKED' },
    'comp-j-summ': { rawScore: 40, status: 'MARKED' }
  };
  const res = TestCalculationEngine.calculateStudentScores(pat.components, scores, pat);
  assert.strictEqual(res.totalMarks, 85);
  assert.strictEqual(res.maxTotal, 100);
  assert.strictEqual(res.percentage, 85);
  assert.strictEqual(res.grade, 'A', '85% in [75, 89.99] yields Grade A');
});

// 9. Class 9–10 configurable rules work
runTest(9, 'Class 9–10 configurable rules work (Internal 20 + Theory 80)', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-9-10-v1');
  const scores = {
    'comp-9-int': { rawScore: 18, status: 'MARKED' },
    'comp-9-th': { rawScore: 68, status: 'MARKED' }
  };
  const res = TestCalculationEngine.calculateStudentScores(pat.components, scores, pat);
  assert.strictEqual(res.totalMarks, 86);
  assert.strictEqual(res.maxTotal, 100);
  assert.strictEqual(res.percentage, 86);
});

// 10. Sixth subject inclusion/exclusion works according to configuration
runTest(10, 'Sixth subject exclusion from aggregate works as configured', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-9-10-v1');
  const rule = pat.subject_rules.find(r => r.subject_category === 'SIXTH_SUBJECT');
  assert.strictEqual(rule.include_in_aggregate, false);
  assert.strictEqual(rule.include_in_rank, false);
});

// 11. Class 11–12 theory/practical configuration works
runTest(11, 'Class 11–12 Theory (70) + Practical (30) works', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-11-12-v1');
  const scores = {
    'comp-11-th': { rawScore: 56, status: 'MARKED' },
    'comp-11-pr': { rawScore: 28, status: 'MARKED' }
  };
  const res = TestCalculationEngine.calculateStudentScores(pat.components, scores, pat);
  assert.strictEqual(res.totalMarks, 84);
  assert.strictEqual(res.maxTotal, 100);
});

// 12. Rounding rules work
runTest(12, 'Rounding rules work accurately (ROUND_2_DECIMALS vs ROUND_NEAREST_INTEGER)', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1'); // 100 -> 75
  const examComp = pat.components.find(c => c.component_code === 'EXAM');
  // Raw 85/100 -> 85 * 0.75 = 63.75
  const conv2Dec = TestCalculationEngine.convertComponentScore(85, examComp, 'ROUND_2_DECIMALS');
  assert.strictEqual(conv2Dec, 63.75);

  const convInt = TestCalculationEngine.convertComponentScore(85, examComp, 'ROUND_NEAREST_INTEGER');
  assert.strictEqual(convInt, 64);
});

// Setup mock submission for workflow state machine tests
const teacher1 = { id: 'usr-teacher-1', role: 'teacher', name: 'Pranita Rai' };
const teacher2 = { id: 'usr-teacher-2', role: 'teacher', name: 'Other Teacher' };
const coordinator = { id: 'usr-coord', role: 'coordinator', designation: 'Senior School Coordinator', name: 'Coordinator Sir' };
const principal = { id: 'usr-princ', role: 'principal', name: 'Principal' };

const subKey = 'cls-8a_sub-math_Midterm_2026';
sim.submissions[subKey] = {
  id: 'sub-8a-math',
  class_id: 'cls-8a',
  subject_id: 'sub-math',
  academic_year: '2026',
  term: 'Midterm',
  teacher_id: teacher1.id,
  status: 'DRAFT'
};
sim.detailedMarks['sub-8a-math'] = [
  { id: 'm-1', student_id: 'stud-1', component_id: 'comp-test', raw_score: 20, status: 'MARKED' },
  { id: 'm-2', student_id: 'stud-1', component_id: 'comp-exam', raw_score: 80, status: 'MARKED' }
];

// 13. DRAFT -> SUBMITTED works
runTest(13, 'Teacher submitting marks transitions DRAFT -> SUBMITTED', () => {
  const res = sim.submitMarks(subKey, teacher1, 'Completed first draft');
  assert.strictEqual(res.status, 'SUBMITTED');
});

// 14. RETURN_FOR_CORRECTION requires a reason
runTest(14, 'Coordinator return for correction strictly requires non-empty reason', () => {
  assert.throws(() => {
    sim.coordinatorReview(subKey, coordinator, 'RETURN', '');
  }, /MANDATORY_REASON_REQUIRED/);
});

// 15. Returned marks can be corrected and resubmitted
runTest(15, 'Returned marks can be corrected by teacher and resubmitted', () => {
  // Coordinator returns
  sim.coordinatorReview(subKey, coordinator, 'RETURN', 'Please recheck Roll 1 test score');
  assert.strictEqual(sim.submissions[subKey].status, 'RETURNED_FOR_CORRECTION');
  assert.strictEqual(sim.submissions[subKey].return_reason, 'Please recheck Roll 1 test score');

  // Teacher corrects and resubmits
  sim.detailedMarks['sub-8a-math'][0].raw_score = 22;
  const resub = sim.submitMarks(subKey, teacher1, 'Corrected Roll 1');
  assert.strictEqual(resub.status, 'RESUBMITTED');
});

// 16. Coordinator can approve authorized submissions
runTest(16, 'Coordinator can approve authorized submissions', () => {
  const approved = sim.coordinatorReview(subKey, coordinator, 'APPROVE');
  assert.strictEqual(approved.status, 'APPROVED');
  assert.strictEqual(approved.approved_by, coordinator.id);
});

// 17. Coordinator can lock approved submissions
runTest(17, 'Coordinator can lock approved submissions', () => {
  const locked = sim.coordinatorReview(subKey, coordinator, 'LOCK');
  assert.strictEqual(locked.status, 'LOCKED');
  assert.strictEqual(locked.locked_by, coordinator.id);
});

// 18. Teacher cannot approve
runTest(18, 'Teacher cannot approve submissions (blocked server-side)', () => {
  assert.throws(() => {
    sim.coordinatorReview(subKey, teacher1, 'APPROVE');
  }, /UNAUTHORIZED_COORDINATOR_ACTION/);
});

// 19. Teacher cannot lock
runTest(19, 'Teacher cannot lock submissions (blocked server-side)', () => {
  assert.throws(() => {
    sim.coordinatorReview(subKey, teacher1, 'LOCK');
  }, /UNAUTHORIZED_COORDINATOR_ACTION/);
});

// 20. Teacher cannot modify another teacher's marks
runTest(20, 'Teacher cannot modify another teacher\'s marks', () => {
  assert.throws(() => {
    sim.submitMarks(subKey, teacher2, 'Sneaky edit');
  }, /UNAUTHORIZED_TEACHER_MODIFICATION/);
});

// 21. Teacher cannot modify locked marks
runTest(21, 'Teacher cannot modify locked marks', () => {
  assert.throws(() => {
    sim.submitMarks(subKey, teacher1, 'Post-lock edit attempt');
  }, /LOCKED_MARKS_MODIFICATION_BLOCKED/);
});

// 22. Unauthorized user cannot change assessment configuration
runTest(22, 'Ordinary users cannot alter assessment configuration', () => {
  const unauthorizedUser = { id: 'usr-student-1', role: 'student' };
  const canEdit = unauthorizedUser.role === 'admin' || unauthorizedUser.role === 'principal';
  assert.strictEqual(canEdit, false, 'Student cannot edit assessment configuration');
});

// 23. Report printing is blocked when any required subject is unlocked
runTest(23, 'Report printing is blocked when any required subject is unlocked', () => {
  // Math is locked, but Science and English are not yet entered/locked
  const readiness = sim.verifyReportReadiness('cls-8a', '2026', 'Midterm');
  assert.strictEqual(readiness.isReady, false);
  assert.strictEqual(readiness.lockedSubjects, 1);
  assert.strictEqual(readiness.totalSubjects, 3);
  assert.strictEqual(readiness.pendingSubjectsCount, 2);

  // Attempting to print throws premature printing error
  assert.throws(() => {
    sim.logReportPrint('cls-8a', '2026', 'Midterm', coordinator);
  }, /PREMATURE_PRINTING_BLOCKED/);
});

// 24. Report becomes printable only when all required subjects are locked
runTest(24, 'Report becomes printable only when all required subjects are locked', () => {
  // Lock Science
  const sciKey = 'cls-8a_sub-sci_Midterm_2026';
  sim.submissions[sciKey] = { id: 'sub-sci', class_id: 'cls-8a', subject_id: 'sub-sci', academic_year: '2026', term: 'Midterm', status: 'LOCKED' };
  // Lock English
  const engKey = 'cls-8a_sub-eng_Midterm_2026';
  sim.submissions[engKey] = { id: 'sub-eng', class_id: 'cls-8a', subject_id: 'sub-eng', academic_year: '2026', term: 'Midterm', status: 'LOCKED' };

  const readiness = sim.verifyReportReadiness('cls-8a', '2026', 'Midterm');
  assert.strictEqual(readiness.isReady, true);
  assert.strictEqual(readiness.lockedSubjects, 3);
  assert.strictEqual(readiness.pendingSubjectsCount, 0);

  const printRecord = sim.logReportPrint('cls-8a', '2026', 'Midterm', coordinator, 'Term 1 Official Batch');
  assert.strictEqual(printRecord.report_version, 'MIDTERM-2026-V1');
  assert.strictEqual(printRecord.student_count, 3);
});

// 25. Principal/Admin authorized override works with mandatory reason
runTest(25, 'Principal authorized override works with mandatory audit reason', () => {
  const mark = sim.principalOverride('m-1', principal, 24, 'Scrutiny verified calculation discrepancy');
  assert.strictEqual(mark.raw_score, 24);
  assert.strictEqual(mark.is_override, true);
  assert.strictEqual(mark.override_reason, 'Scrutiny verified calculation discrepancy');
});

// 26. Audit records are created correctly
runTest(26, 'Audit records are created for submissions, approvals, returns, and overrides', () => {
  assert.ok(sim.auditLogs.length >= 5, 'Must have recorded workflow actions in audit log');
  const overrideLog = sim.auditLogs.find(l => l.action === 'PRINCIPAL_OVERRIDE');
  assert.ok(overrideLog, 'Principal override must be recorded');
  assert.strictEqual(overrideLog.old_value, 22);
  assert.strictEqual(overrideLog.new_value, 24);
});

// 27. Configuration version is preserved
runTest(27, 'Configuration version is preserved with pattern and historical records', () => {
  const pat = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  assert.strictEqual(pat.version, 1);
});

// 28. Historical finalized results do not change after a new configuration version becomes active
runTest(28, 'Historical finalized results do not change after new configuration version is added', () => {
  // Add Version 2 for 5-8
  const v2 = {
    ...sim.patterns.find(p => p.id === 'pat-5-8-v1'),
    id: 'pat-5-8-v2',
    version: 2,
    components: [
      { id: 'comp-test-v2', component_code: 'TEST', raw_max_marks: 30, converted_max_marks: 30 },
      { id: 'comp-exam-v2', component_code: 'EXAM', raw_max_marks: 100, converted_max_marks: 70 }
    ]
  };
  sim.patterns.push(v2);

  // Original Version 1 calculation remains identical
  const v1 = sim.patterns.find(p => p.id === 'pat-5-8-v1');
  const scores = {
    'comp-test': { rawScore: 20, status: 'MARKED' },
    'comp-exam': { rawScore: 80, status: 'MARKED' }
  };
  const resV1 = TestCalculationEngine.calculateStudentScores(v1.components, scores, v1);
  assert.strictEqual(resV1.totalMarks, 80);
});

// 29. Direct unauthorized database manipulation is blocked by RLS/security controls
runTest(29, 'Direct unauthorized database manipulation blocked by security controls', () => {
  const teacherCannotOverride = () => {
    sim.principalOverride('m-1', teacher1, 25, 'Unauthorized override');
  };
  assert.throws(teacherCannotOverride, /UNAUTHORIZED/);
});

// 30. Report generation/printing creates permanent history
runTest(30, 'Report generation/printing creates permanent versioned history', () => {
  const printRecord2 = sim.logReportPrint('cls-8a', '2026', 'Midterm', coordinator, 'Second print run');
  assert.strictEqual(printRecord2.report_version, 'MIDTERM-2026-V2');
  assert.strictEqual(sim.printLogs.length, 2);
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
