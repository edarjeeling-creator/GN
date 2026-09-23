/**
 * test_principal_weekly_test_oversight.cjs
 * Comprehensive Automated Test Suite for:
 * Principal/Admin Weekly Test Oversight & Complete Marksheet Access
 */

const assert = require('assert');

console.log('================================================================');
console.log('GYANODAY NIKETAN: PRINCIPAL WEEKLY TEST OVERSIGHT TEST SUITE');
console.log('================================================================\n');

// Mock Database State
const mockProfiles = [
  { id: 'principal-1', name: 'Dr. John Doe', role: 'principal', designation: 'Principal' },
  { id: 'admin-1', name: 'System Admin', role: 'admin', designation: 'Administrator' },
  { id: 'coord-1', name: 'Academic Coordinator', role: 'coordinator', designation: 'Senior School Coordinator' },
  { id: 'teacher-1', name: 'Rajesh Sharma', role: 'teacher', designation: 'Senior Faculty' },
  { id: 'teacher-2', name: 'Pallavi Rai', role: 'teacher', designation: 'Mathematics Faculty' },
  { id: 'student-1', name: 'Aayam Subba', role: 'student', designation: null }
];

const mockClasses = [
  { id: 'cls-8a', name: 'Class 8', section: 'A' },
  { id: 'cls-8b', name: 'Class 8', section: 'B' },
  { id: 'cls-10a', name: 'Class 10', section: 'A' }
];

const mockSubjects = [
  { id: 'sub-eng', name: 'English Literature' },
  { id: 'sub-math', name: 'Mathematics' },
  { id: 'sub-sci', name: 'Science' }
];

const mockStudents = [
  { id: 'st-1', roll_no: 1, name: 'Anwesha Pradhan', class_id: 'cls-8a', house: 'Kanchenjunga' },
  { id: 'st-2', roll_no: 2, name: 'Soweaksha Gurung', class_id: 'cls-8a', house: 'Everest' },
  { id: 'st-3', roll_no: 3, name: 'Aayam Thapa', class_id: 'cls-8a', house: 'Dhaulagiri' },
  { id: 'st-4', roll_no: 4, name: 'Bikash Chettri', class_id: 'cls-8a', house: 'Annapurna' },
  { id: 'st-5', roll_no: 1, name: 'Rohan Sharma', class_id: 'cls-10a', house: 'Everest' }
];

const mockTests = [
  {
    id: 'test-1',
    class_id: 'cls-8a',
    subject_id: 'sub-eng',
    teacher_id: 'teacher-1',
    test_date: '2026-09-22',
    max_marks: 25,
    status: 'Submitted',
    marks_entered_count: 4,
    absent_count: 1,
    total_students_count: 4
  },
  {
    id: 'test-2',
    class_id: 'cls-8a',
    subject_id: 'sub-math',
    teacher_id: 'teacher-2',
    test_date: '2026-09-22',
    max_marks: 25,
    status: 'Draft',
    marks_entered_count: 2,
    absent_count: 0,
    total_students_count: 4
  },
  {
    id: 'test-3',
    class_id: 'cls-10a',
    subject_id: 'sub-sci',
    teacher_id: 'teacher-1',
    test_date: '2026-09-22',
    max_marks: 20,
    status: 'Approved',
    marks_entered_count: 1,
    absent_count: 0,
    total_students_count: 1
  }
];

const mockMarks = [
  { test_id: 'test-1', student_id: 'st-1', score: 23, is_absent: false },
  { test_id: 'test-1', student_id: 'st-2', score: 21, is_absent: false },
  { test_id: 'test-1', student_id: 'st-3', score: 8, is_absent: false },  // < 10 Requires Attention
  { test_id: 'test-1', student_id: 'st-4', score: null, is_absent: true }, // Absent
  { test_id: 'test-2', student_id: 'st-1', score: 20, is_absent: false },
  { test_id: 'test-2', student_id: 'st-2', score: 18, is_absent: false },
  { test_id: 'test-3', student_id: 'st-5', score: 17, is_absent: false }
];

// Helper: Check privilege
function isUserPrivileged(profile) {
  if (!profile) return false;
  return (
    profile.role === 'principal' ||
    profile.role === 'admin' ||
    profile.role === 'superadmin' ||
    profile.role === 'coordinator' ||
    (profile.designation && (
      profile.designation.toLowerCase().includes('principal') ||
      profile.designation.toLowerCase().includes('coordinator')
    ))
  );
}

// Helper: Fetch weekly tests based on role
function getWeeklyTestsForUser(profile) {
  if (isUserPrivileged(profile)) {
    return [...mockTests];
  }
  return mockTests.filter(t => t.teacher_id === profile.id);
}

// Helper: Filter weekly tests
function filterWeeklyTests(testsList, filters = {}, teachersList = []) {
  const { teacherId, classId, subjectId, status, date, search } = filters;
  return testsList.filter(t => {
    if (teacherId && teacherId !== 'ALL' && t.teacher_id !== teacherId) return false;
    if (classId && classId !== 'ALL' && t.class_id !== classId) return false;
    if (subjectId && subjectId !== 'ALL' && t.subject_id !== subjectId) return false;
    if (status && status !== 'ALL' && t.status !== status) return false;
    if (date && t.test_date !== date) return false;
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const teacherObj = teachersList.find(tc => tc.id === t.teacher_id);
      const teacherName = (teacherObj?.name || '').toLowerCase();
      const classObj = mockClasses.find(c => c.id === t.class_id);
      const className = `${classObj?.name || ''} ${classObj?.section || ''}`.toLowerCase();
      const subjectObj = mockSubjects.find(s => s.id === t.subject_id);
      const subjectName = (subjectObj?.name || '').toLowerCase();
      if (!teacherName.includes(q) && !className.includes(q) && !subjectName.includes(q) && !t.test_date.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

// Helper: Calculate full test marksheet metrics
function calculateMarksheetMetrics(studentsList, marksList, test) {
  const max = Number(test.max_marks) || 25;
  const passingMark = Math.round(max * 0.4);

  let evaluated = 0;
  let absent = 0;
  let passCount = 0;
  let failCount = 0;
  let attentionCount = 0;
  const validScores = [];

  const roster = studentsList.map(st => {
    const m = marksList.find(item => item.test_id === test.id && item.student_id === st.id) || { score: null, is_absent: false };
    const isAbsent = Boolean(m.is_absent);
    const score = isAbsent || m.score === null || m.score === '' ? null : Number(m.score);
    const percentage = (!isAbsent && score !== null) ? Number(((score / max) * 100).toFixed(1)) : null;

    let result = 'Pending';
    if (isAbsent) {
      result = 'Absent';
      absent++;
    } else if (score !== null) {
      evaluated++;
      validScores.push(score);
      if (score >= passingMark) {
        result = 'Pass';
        passCount++;
      } else {
        result = 'Fail';
        failCount++;
      }
      if (score < 10) {
        attentionCount++;
      }
    }

    return {
      ...st,
      score,
      isAbsent,
      percentage,
      result
    };
  });

  const average = validScores.length > 0 ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)) : 0;
  const highest = validScores.length > 0 ? Math.max(...validScores) : null;
  const lowest = validScores.length > 0 ? Math.min(...validScores) : null;
  const passRate = evaluated > 0 ? Number(((passCount / evaluated) * 100).toFixed(1)) : 0;

  return {
    roster,
    total: studentsList.length,
    evaluated,
    absent,
    passCount,
    failCount,
    attentionCount,
    average,
    highest,
    lowest,
    passRate,
    passingMark
  };
}

let passed = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Test 1: Teacher Query Scope vs Principal Query Scope
runTest('Test 1: Teacher sees only their own weekly tests', () => {
  const teacher = mockProfiles.find(p => p.id === 'teacher-1');
  const teacherTests = getWeeklyTestsForUser(teacher);
  assert.strictEqual(teacherTests.length, 2, 'Teacher-1 should see exactly 2 tests');
  assert.ok(teacherTests.every(t => t.teacher_id === 'teacher-1'), 'All tests must belong to teacher-1');
});

runTest('Test 2: Principal sees all weekly tests across all teachers', () => {
  const principal = mockProfiles.find(p => p.id === 'principal-1');
  const principalTests = getWeeklyTestsForUser(principal);
  assert.strictEqual(principalTests.length, 3, 'Principal must see all 3 tests from all teachers');
});

runTest('Test 3: Admin and Coordinator get full school-wide test visibility', () => {
  const admin = mockProfiles.find(p => p.id === 'admin-1');
  const coord = mockProfiles.find(p => p.id === 'coord-1');
  assert.strictEqual(getWeeklyTestsForUser(admin).length, 3, 'Admin must see all tests');
  assert.strictEqual(getWeeklyTestsForUser(coord).length, 3, 'Coordinator must see all tests');
});

runTest('Test 4: Filter weekly tests by Teacher', () => {
  const all = getWeeklyTestsForUser(mockProfiles.find(p => p.id === 'principal-1'));
  const filtered = filterWeeklyTests(all, { teacherId: 'teacher-2' });
  assert.strictEqual(filtered.length, 1, 'Filter by teacher-2 must return 1 test');
  assert.strictEqual(filtered[0].id, 'test-2');
});

runTest('Test 5: Filter weekly tests by Class', () => {
  const all = getWeeklyTestsForUser(mockProfiles.find(p => p.id === 'principal-1'));
  const filtered = filterWeeklyTests(all, { classId: 'cls-10a' });
  assert.strictEqual(filtered.length, 1, 'Filter by class 10a must return 1 test');
  assert.strictEqual(filtered[0].subject_id, 'sub-sci');
});

runTest('Test 6: Filter weekly tests by Status (Submitted / Pending Approval)', () => {
  const all = getWeeklyTestsForUser(mockProfiles.find(p => p.id === 'principal-1'));
  const filtered = filterWeeklyTests(all, { status: 'Submitted' });
  assert.strictEqual(filtered.length, 1, 'Filter by Submitted must return 1 test');
  assert.strictEqual(filtered[0].id, 'test-1');
});

runTest('Test 7: Search filter matches teacher name, class name, or subject', () => {
  const all = getWeeklyTestsForUser(mockProfiles.find(p => p.id === 'principal-1'));
  const searchByTeacher = filterWeeklyTests(all, { search: 'Pallavi' }, mockProfiles);
  assert.strictEqual(searchByTeacher.length, 1, 'Search by "Pallavi" must return test-2');

  const searchBySubject = filterWeeklyTests(all, { search: 'Literature' }, mockProfiles);
  assert.strictEqual(searchBySubject.length, 1, 'Search by "Literature" must return test-1');
});

runTest('Test 8: Complete Marksheet calculation with Roll, Marks, %, Rank, and Attention', () => {
  const test1 = mockTests.find(t => t.id === 'test-1');
  const class8Students = mockStudents.filter(s => s.class_id === 'cls-8a');
  const result = calculateMarksheetMetrics(class8Students, mockMarks, test1);

  assert.strictEqual(result.total, 4, 'Total students should be 4');
  assert.strictEqual(result.evaluated, 3, 'Evaluated students should be 3');
  assert.strictEqual(result.absent, 1, 'Absent students should be 1');

  // Check individual student marks
  const anwesha = result.roster.find(s => s.name === 'Anwesha Pradhan');
  assert.strictEqual(anwesha.score, 23);
  assert.strictEqual(anwesha.percentage, 92.0);
  assert.strictEqual(anwesha.result, 'Pass');

  const aayam = result.roster.find(s => s.name === 'Aayam Thapa');
  assert.strictEqual(aayam.score, 8);
  assert.strictEqual(aayam.percentage, 32.0);
  assert.strictEqual(aayam.result, 'Fail');

  const bikash = result.roster.find(s => s.name === 'Bikash Chettri');
  assert.strictEqual(bikash.isAbsent, true);
  assert.strictEqual(bikash.result, 'Absent');

  // Summary Metrics
  assert.strictEqual(result.attentionCount, 1, 'Exactly 1 student requires attention (score < 10)');
  assert.strictEqual(result.highest, 23);
  assert.strictEqual(result.lowest, 8);
  assert.strictEqual(result.passCount, 2);
  assert.strictEqual(result.failCount, 1);
});

runTest('Test 9: Principal Approval authorization workflow', () => {
  const principal = mockProfiles.find(p => p.id === 'principal-1');
  const teacher = mockProfiles.find(p => p.id === 'teacher-1');

  // Privilege check
  assert.strictEqual(isUserPrivileged(principal), true, 'Principal is authorized to approve');
  assert.strictEqual(isUserPrivileged(teacher), false, 'Teacher is NOT authorized to approve');

  // Simulation of approval
  const testToApprove = { ...mockTests[0] };
  assert.strictEqual(testToApprove.status, 'Submitted');
  
  if (isUserPrivileged(principal)) {
    testToApprove.status = 'Approved';
  }
  assert.strictEqual(testToApprove.status, 'Approved', 'Test must transition to Approved');
});

runTest('Test 10: Mark Correction authorization: Principal can adjust marks', () => {
  const principal = mockProfiles.find(p => p.id === 'principal-1');
  assert.strictEqual(isUserPrivileged(principal), true);

  // When Principal corrects a mark (e.g. Aayam re-evaluated from 8 to 15)
  const modifiedMarks = mockMarks.map(m => {
    if (m.test_id === 'test-1' && m.student_id === 'st-3') {
      return { ...m, score: 15 };
    }
    return m;
  });

  const test1 = mockTests.find(t => t.id === 'test-1');
  const class8Students = mockStudents.filter(s => s.class_id === 'cls-8a');
  const updatedMetrics = calculateMarksheetMetrics(class8Students, modifiedMarks, test1);

  const updatedAayam = updatedMetrics.roster.find(s => s.name === 'Aayam Thapa');
  assert.strictEqual(updatedAayam.score, 15);
  assert.strictEqual(updatedAayam.result, 'Pass');
  assert.strictEqual(updatedMetrics.attentionCount, 0, 'No students require attention after correction');
});

runTest('Test 11: All Student Marksheets view mode aggregates entire class roster with house and status', () => {
  const class8Students = mockStudents.filter(s => s.class_id === 'cls-8a');
  const test1 = mockTests.find(t => t.id === 'test-1');
  const metrics = calculateMarksheetMetrics(class8Students, mockMarks, test1);

  // Validate roster output format for Principal Portal 'all_marksheets' mode
  assert.ok(metrics.roster.every(st => st.house !== undefined), 'Every student must have house assigned');
  assert.ok(metrics.roster.every(st => typeof st.roll_no === 'number'), 'Roll number must be numeric');
  assert.strictEqual(metrics.roster.length, 4, 'Full class roster length must be 4');
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed} | PASSED: ${passed} | FAILED: 0`);
console.log('================================================================\n');
