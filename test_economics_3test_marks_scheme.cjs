// test_economics_3test_marks_scheme.cjs
// Comprehensive test suite for Class 9H & 10H Economics 3-Test + Automated Average Scheme

const assert = require('assert');

async function runTests() {
  console.log('🧪 Starting Economics 3-Test Assessment Scheme Test Suite...\n');

  const { MarksCalculationEngine } = await import('./src/services/MarksCalculationEngine.js');

  const academicYear = '2026';
  const dummyPatterns = [
    {
      id: 'p-9-10',
      academic_year: '2026',
      pattern_name: 'Secondary School (Classes 9-10) Scheme',
      class_group: 'SECONDARY_9_10',
      applicable_classes: ['Class 9', 'Class 10', '9', '10', '9H', '10H'],
      status: 'ACTIVE',
      components: [
        { id: 'c-test', component_code: 'TEST', component_name: 'Periodic Test', raw_max_marks: 20, converted_max_marks: 20, contributes_to_total: true },
        { id: 'c-exam', component_code: 'EXAM', component_name: 'Term Exam', raw_max_marks: 100, converted_max_marks: 80, contributes_to_total: true }
      ]
    },
    {
      id: 'p-11-12',
      academic_year: '2026',
      pattern_name: 'Higher Secondary (Classes 11-12) Scheme',
      class_group: 'HIGHER_SECONDARY_11_12',
      applicable_classes: ['Class 11', 'Class 12', '11', '12'],
      status: 'ACTIVE',
      components: [
        { id: 'c-th', component_code: 'THEORY', component_name: 'Theory', raw_max_marks: 70, converted_max_marks: 70, contributes_to_total: true },
        { id: 'c-pr', component_code: 'PRACTICAL', component_name: 'Practical', raw_max_marks: 30, converted_max_marks: 30, contributes_to_total: true }
      ]
    }
  ];

  // ----------------------------------------------------
  // TEST 1: Scope Isolation & Pattern Resolution
  // ----------------------------------------------------
  console.log('Test 1: Pattern Resolution Scope Isolation');

  // 1A. 9H Economics -> SECONDARY_ECONOMICS_3TEST
  const p9HEco = MarksCalculationEngine.resolvePattern('9', academicYear, dummyPatterns, 'Economics', 'H');
  assert.strictEqual(p9HEco.class_group, 'SECONDARY_ECONOMICS_3TEST', '9H Economics must resolve to SECONDARY_ECONOMICS_3TEST');
  console.log('  ✓ 9H Economics correctly resolves to SECONDARY_ECONOMICS_3TEST');

  // 1B. 10H Economics -> SECONDARY_ECONOMICS_3TEST
  const p10HEco = MarksCalculationEngine.resolvePattern('10', academicYear, dummyPatterns, 'Economics', 'H');
  assert.strictEqual(p10HEco.class_group, 'SECONDARY_ECONOMICS_3TEST', '10H Economics must resolve to SECONDARY_ECONOMICS_3TEST');
  console.log('  ✓ 10H Economics correctly resolves to SECONDARY_ECONOMICS_3TEST');

  // 1C. Combined class name "Class 9 H" or "9H"
  const p9HComb = MarksCalculationEngine.resolvePattern('Class 9 H', academicYear, dummyPatterns, 'Economics');
  assert.strictEqual(p9HComb.class_group, 'SECONDARY_ECONOMICS_3TEST', 'Combined Class 9 H Economics must resolve to SECONDARY_ECONOMICS_3TEST');
  console.log('  ✓ "Class 9 H" Economics correctly resolves to SECONDARY_ECONOMICS_3TEST');

  // 1D. 9H Mathematics -> Standard SECONDARY_9_10 (NOT Economics)
  const p9HMath = MarksCalculationEngine.resolvePattern('9', academicYear, dummyPatterns, 'Mathematics', 'H');
  assert.strictEqual(p9HMath.class_group, 'SECONDARY_9_10', '9H Mathematics must retain standard SECONDARY_9_10 pattern');
  console.log('  ✓ 9H Mathematics correctly retains standard SECONDARY_9_10 pattern');

  // 1E. 10H English -> Standard SECONDARY_9_10 (NOT Economics)
  const p10HEng = MarksCalculationEngine.resolvePattern('10', academicYear, dummyPatterns, 'English', 'H');
  assert.strictEqual(p10HEng.class_group, 'SECONDARY_9_10', '10H English must retain standard SECONDARY_9_10 pattern');
  console.log('  ✓ 10H English correctly retains standard SECONDARY_9_10 pattern');

  // 1F. Class 9 Section Sc Economics -> Standard SECONDARY_9_10 (NOT Section H)
  const p9ScEco = MarksCalculationEngine.resolvePattern('9', academicYear, dummyPatterns, 'Economics', 'Sc');
  assert.strictEqual(p9ScEco.class_group, 'SECONDARY_9_10', '9Sc Economics must retain standard SECONDARY_9_10 pattern');
  console.log('  ✓ 9Sc Economics correctly retains standard SECONDARY_9_10 pattern');

  // 1G. Class 11 Section H Economics -> HIGHER_SECONDARY_11_12 (NOT Class 9 or 10)
  const p11HEco = MarksCalculationEngine.resolvePattern('11', academicYear, dummyPatterns, 'Economics', 'H');
  assert.strictEqual(p11HEco.class_group, 'HIGHER_SECONDARY_11_12', '11H Economics must retain standard HIGHER_SECONDARY_11_12 pattern');
  console.log('  ✓ 11H Economics correctly retains standard HIGHER_SECONDARY_11_12 pattern');

  // ----------------------------------------------------
  // TEST 2: Component Structure & Rules
  // ----------------------------------------------------
  console.log('\nTest 2: Economics 3-Test Component Architecture');
  const ecoPattern = MarksCalculationEngine.getDefaultEconomics3TestPattern(academicYear);
  assert.strictEqual(ecoPattern.components.length, 4, 'Must have exactly 4 components');
  
  const [t1, t2, t3, tAvg] = ecoPattern.components;
  assert.strictEqual(t1.component_code, 'TEST_1');
  assert.strictEqual(t1.raw_max_marks, 20);
  assert.strictEqual(t1.contributes_to_total, false, 'TEST_1 must not directly contribute to total');

  assert.strictEqual(t2.component_code, 'TEST_2');
  assert.strictEqual(t2.raw_max_marks, 20);
  assert.strictEqual(t2.contributes_to_total, false, 'TEST_2 must not directly contribute to total');

  assert.strictEqual(t3.component_code, 'TEST_3');
  assert.strictEqual(t3.raw_max_marks, 20);
  assert.strictEqual(t3.contributes_to_total, false, 'TEST_3 must not directly contribute to total');

  assert.strictEqual(tAvg.component_code, 'TEST_AVG');
  assert.strictEqual(tAvg.raw_max_marks, 20);
  assert.strictEqual(tAvg.converted_max_marks, 20);
  assert.strictEqual(tAvg.contributes_to_total, true, 'TEST_AVG must contribute to total');
  assert.strictEqual(tAvg.is_calculated, true, 'TEST_AVG must be marked as calculated');
  console.log('  ✓ Component structure verified: 3 raw tests (Max 20 each) + 1 Auto Average (Max 20)');

  // ----------------------------------------------------
  // TEST 3: Average Calculation Formulas & Scenarios
  // ----------------------------------------------------
  console.log('\nTest 3: Average Calculation Formula & Corner Cases');

  // Scenario 3A: 18 + 15 + 17 = 50 / 3 = 16.67
  const res3A = MarksCalculationEngine.calculateEconomics3TestAverage({
    test1: 18, test2: 15, test3: 17
  });
  assert.strictEqual(res3A.averageScore, 16.67, '18 + 15 + 17 should equal 16.67');
  assert.strictEqual(res3A.displayText, '16.67');
  assert.strictEqual(res3A.status, 'MARKED');
  console.log('  ✓ 18 + 15 + 17 = 50 / 3 = 16.67 verified');

  // Scenario 3B: Decimal marks (18.5 + 15.5 + 17 = 51 / 3 = 17.00)
  const res3B = MarksCalculationEngine.calculateEconomics3TestAverage({
    test1: 18.5, test2: 15.5, test3: 17
  });
  assert.strictEqual(res3B.averageScore, 17.00, '18.5 + 15.5 + 17 should equal 17.00');
  console.log('  ✓ Decimal marks: 18.5 + 15.5 + 17 = 51 / 3 = 17.00 verified');

  // Scenario 3C: Absent in 1 test (18 + 15 + AB = 33 / 2 = 16.50)
  // ABSENT MUST NOT BE TREATED AS ZERO!
  const res3C = MarksCalculationEngine.calculateEconomics3TestAverage({
    test1: 18, test2: 15, test3: '',
    status3: 'ABSENT'
  });
  assert.strictEqual(res3C.averageScore, 16.50, '18 + 15 + AB should equal 16.50 (denominator = 2)');
  assert.strictEqual(res3C.displayText, '16.50');
  console.log('  ✓ Absent in 1 test: 18 + 15 + AB = 33 / 2 = 16.50 verified (AB excluded from denominator)');

  // Scenario 3D: Absent in 2 tests (20 + AB + AB = 20 / 1 = 20.00)
  const res3D = MarksCalculationEngine.calculateEconomics3TestAverage({
    test1: 20, test2: '', test3: '',
    status2: 'ABSENT', status3: 'ABSENT'
  });
  assert.strictEqual(res3D.averageScore, 20.00, '20 + AB + AB should equal 20.00 (denominator = 1)');
  console.log('  ✓ Absent in 2 tests: 20 + AB + AB = 20 / 1 = 20.00 verified');

  // Scenario 3E: Absent in all 3 tests (AB + AB + AB)
  // MUST REMAIN AB, NOT 0!
  const res3E = MarksCalculationEngine.calculateEconomics3TestAverage({
    test1: '', test2: '', test3: '',
    status1: 'ABSENT', status2: 'ABSENT', status3: 'ABSENT'
  });
  assert.strictEqual(res3E.averageScore, null, 'All absent should return averageScore null');
  assert.strictEqual(res3E.status, 'ABSENT', 'All absent should have status ABSENT');
  assert.strictEqual(res3E.displayText, 'AB', 'All absent displayText must be "AB"');
  console.log('  ✓ All absent: AB + AB + AB = AB (not 0) verified');

  // Scenario 3F: Unentered / Blank
  const res3F = MarksCalculationEngine.calculateEconomics3TestAverage({
    test1: '', test2: '', test3: ''
  });
  assert.strictEqual(res3F.averageScore, null);
  assert.strictEqual(res3F.displayText, '');
  console.log('  ✓ Unentered student returns empty display and null score verified');

  // ----------------------------------------------------
  // TEST 4: Student Result Calculation & Grade Mapping
  // ----------------------------------------------------
  console.log('\nTest 4: calculateStudentResult with Economics 3-Test Pattern');

  // 4A. Student with 18, 15, 17
  const studentResultA = MarksCalculationEngine.calculateStudentResult({
    components: ecoPattern.components,
    rawScores: { TEST_1: 18, TEST_2: 15, TEST_3: 17 },
    statuses: { TEST_1: 'MARKED', TEST_2: 'MARKED', TEST_3: 'MARKED' },
    gradeBoundaries: ecoPattern.grade_boundaries,
    roundingRule: 'ROUND_2_DECIMALS'
  });
  assert.strictEqual(studentResultA.totalConverted, 16.67, 'Total converted should be 16.67');
  assert.strictEqual(studentResultA.percentage, 83.35, 'Percentage should be (16.67 / 20) * 100 = 83.35%');
  assert.strictEqual(studentResultA.grade, 'A', '83.35% should map to Grade A (80-100%)');
  console.log('  ✓ Student (18, 15, 17) -> Total: 16.67/20, Percentage: 83.35%, Grade: A');

  // 4B. Student with 18, 15, AB
  const studentResultB = MarksCalculationEngine.calculateStudentResult({
    components: ecoPattern.components,
    rawScores: { TEST_1: 18, TEST_2: 15, TEST_3: '' },
    statuses: { TEST_1: 'MARKED', TEST_2: 'MARKED', TEST_3: 'ABSENT' },
    gradeBoundaries: ecoPattern.grade_boundaries,
    roundingRule: 'ROUND_2_DECIMALS'
  });
  assert.strictEqual(studentResultB.totalConverted, 16.50, 'Total converted should be 16.50');
  assert.strictEqual(studentResultB.percentage, 82.50, 'Percentage should be (16.50 / 20) * 100 = 82.50%');
  assert.strictEqual(studentResultB.grade, 'A', '82.50% should map to Grade A');
  console.log('  ✓ Student (18, 15, AB) -> Total: 16.50/20, Percentage: 82.50%, Grade: A');

  // 4C. Student with all AB
  const studentResultC = MarksCalculationEngine.calculateStudentResult({
    components: ecoPattern.components,
    rawScores: { TEST_1: '', TEST_2: '', TEST_3: '' },
    statuses: { TEST_1: 'ABSENT', TEST_2: 'ABSENT', TEST_3: 'ABSENT' },
    gradeBoundaries: ecoPattern.grade_boundaries,
    roundingRule: 'ROUND_2_DECIMALS'
  });
  assert.strictEqual(studentResultC.grade, 'AB', 'All absent student must receive Grade "AB"');
  assert.strictEqual(studentResultC.isAllAbsent, true, 'isAllAbsent must be true');
  console.log('  ✓ Student (AB, AB, AB) -> isAllAbsent: true, Grade: "AB"');

  // ----------------------------------------------------
  // TEST 5: Tuesday Assembly Honours Ranking with Economics
  // ----------------------------------------------------
  console.log('\nTest 5: Tuesday Assembly Honours Ranking');
  const roster = [
    {
      student: { id: 's1', name: 'Rohan Sharma', roll_no: 1 },
      total: 18.00,
      isAbsent: false,
      grade: 'A'
    },
    {
      student: { id: 's2', name: 'Priya Patel', roll_no: 2 },
      total: 16.67,
      isAbsent: false,
      grade: 'A'
    },
    {
      student: { id: 's3', name: 'Amit Kumar', roll_no: 3 },
      total: 16.50,
      isAbsent: false,
      grade: 'A'
    },
    {
      student: { id: 's4', name: 'Bikash Subba', roll_no: 4 },
      total: 8.50,
      isAbsent: false,
      grade: 'D'
    },
    {
      student: { id: 's5', name: 'Inactive Student', roll_no: 5 },
      total: 0,
      isAbsent: true,
      grade: 'AB'
    }
  ];

  const honours = MarksCalculationEngine.calculateHonoursAndAttention(roster, {
    rankingPolicy: 'DENSE',
    requiresAttentionThreshold: 10,
    thresholdType: 'SCORE',
    excludeAbsentFromRanking: true
  });

  assert.strictEqual(honours.topScorers.length, 3, 'Should have 3 top scorers');
  assert.strictEqual(honours.topScorers[0].student.name, 'Rohan Sharma');
  assert.strictEqual(honours.topScorers[0].rank, 1);
  assert.strictEqual(honours.topScorers[1].student.name, 'Priya Patel');
  assert.strictEqual(honours.topScorers[1].rank, 2);
  assert.strictEqual(honours.topScorers[2].student.name, 'Amit Kumar');
  assert.strictEqual(honours.topScorers[2].rank, 3);

  assert.strictEqual(honours.requiresAttention.length, 1, 'Should have 1 student requiring attention (below 10)');
  assert.strictEqual(honours.requiresAttention[0].student.name, 'Bikash Subba');
  assert.strictEqual(honours.absentees.length, 1, 'Should have 1 absentee');
  console.log('  ✓ Tuesday Assembly Honours correctly ranks 1st (18.00), 2nd (16.67), 3rd (16.50)');
  console.log('  ✓ Requires attention correctly identifies student scoring 8.50 (< 10)');
  console.log('  ✓ Absent student correctly excluded from rankings');

  console.log('\n🎉 ALL 5 TEST MODULES PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
