/**
 * test_multiple_test_attempts_system.cjs
 * Comprehensive Automated Test Suite for Expandable Multiple-Test / Test Attempt System
 * Verifies all 38 requirement scenarios, calculations, AB/NA handling, validation, and aggregations.
 */

const assert = require('assert');

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: EXPANDABLE MULTIPLE-TEST / TEST ATTEMPT SYSTEM');
  console.log('================================================================\n');

  const { MarksCalculationEngine } = await import('./src/services/MarksCalculationEngine.js');

  // ----------------------------------------------------
  // TEST 1: Single Test Attempt (Default Behavior)
  // ----------------------------------------------------
  console.log('Test 1: Single Test Attempt (Existing Behavior Preserved)');
  const attempts1 = [{ id: 'att_1', attempt_number: 1, attempt_name: 'Test 1', raw_max_marks: 25 }];
  const scores1 = { att_1: { score: 20, status: 'MARKED' } };

  const res1 = MarksCalculationEngine.aggregateAttempts({ attempts: attempts1, scores: scores1 });
  assert.strictEqual(res1.aggregatedScore, 20, 'Single test 20 should produce average 20');
  assert.strictEqual(res1.displayText, '20');
  assert.strictEqual(res1.status, 'MARKED');
  assert.strictEqual(res1.validCount, 1);
  console.log('  ✓ Single test 20/25 correctly resolves to official mark 20/25');

  // ----------------------------------------------------
  // TEST 2: Two Tests (20 + 24 = 44 / 2 = 22)
  // ----------------------------------------------------
  console.log('\nTest 2: Two Tests Arithmetic Average');
  const attempts2 = [
    { id: 'att_1', attempt_number: 1, attempt_name: 'Test 1', raw_max_marks: 25 },
    { id: 'att_2', attempt_number: 2, attempt_name: 'Test 2', raw_max_marks: 25 }
  ];
  const scores2 = {
    att_1: { score: 20, status: 'MARKED' },
    att_2: { score: 24, status: 'MARKED' }
  };

  const res2 = MarksCalculationEngine.aggregateAttempts({ attempts: attempts2, scores: scores2 });
  assert.strictEqual(res2.aggregatedScore, 22, '20 + 24 / 2 should equal 22');
  assert.strictEqual(res2.displayText, '22');
  assert.strictEqual(res2.validCount, 2);
  console.log('  ✓ Two tests (20 + 24) correctly average to 22/25');

  // ----------------------------------------------------
  // TEST 3: Three Tests (18 + 21 + 24 = 63 / 3 = 21)
  // ----------------------------------------------------
  console.log('\nTest 3: Three Tests Dynamic Scaling');
  const attempts3 = [
    { id: 'att_1', attempt_number: 1, attempt_name: 'Test 1', raw_max_marks: 25 },
    { id: 'att_2', attempt_number: 2, attempt_name: 'Test 2', raw_max_marks: 25 },
    { id: 'att_3', attempt_number: 3, attempt_name: 'Test 3', raw_max_marks: 25 }
  ];
  const scores3 = {
    att_1: { score: 18, status: 'MARKED' },
    att_2: { score: 21, status: 'MARKED' },
    att_3: { score: 24, status: 'MARKED' }
  };

  const res3 = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores3 });
  assert.strictEqual(res3.aggregatedScore, 21, '18 + 21 + 24 / 3 should equal 21');
  assert.strictEqual(res3.validCount, 3);
  console.log('  ✓ Three tests (18 + 21 + 24) correctly average to 21/25');

  // ----------------------------------------------------
  // TEST 4: Empty / Unused Attempt Must NOT Participate
  // ----------------------------------------------------
  console.log('\nTest 4: Empty / Unused Attempt Ignored from Calculation');
  // Test 1 = 20, Test 2 = 24, Test 3 = empty
  // Expected average = (20 + 24) / 2 = 22 (NOT 14.67)
  const scores4 = {
    att_1: { score: 20, status: 'MARKED' },
    att_2: { score: 24, status: 'MARKED' },
    att_3: { score: '', status: 'MARKED' }
  };

  const res4 = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores4 });
  assert.strictEqual(res4.aggregatedScore, 22, 'Empty attempt 3 must be excluded: (20 + 24) / 2 = 22');
  assert.strictEqual(res4.validCount, 2);
  assert.strictEqual(res4.emptyCount, 1);
  console.log('  ✓ Unused Test 3 is strictly omitted from denominator and average remains 22/25');

  // ----------------------------------------------------
  // TEST 5: Absent (AB) Handling — NOT Zero!
  // ----------------------------------------------------
  console.log('\nTest 5: Absent (AB) Handling');
  // Case 5A: Test 1 = 20, Test 2 = AB -> Average = 20 (NOT 10!)
  const scores5A = {
    att_1: { score: 20, status: 'MARKED' },
    att_2: { score: '', status: 'ABSENT' }
  };
  const res5A = MarksCalculationEngine.aggregateAttempts({ attempts: attempts2, scores: scores5A });
  assert.strictEqual(res5A.aggregatedScore, 20, '20 + AB must average to 20 (denominator = 1)');
  assert.strictEqual(res5A.validCount, 1);
  assert.strictEqual(res5A.absentCount, 1);
  console.log('  ✓ Test 1 = 20, Test 2 = AB correctly produces average 20 (NOT 10)');

  // Case 5B: Test 1 = AB, Test 2 = 24 -> Average = 24
  const scores5B = {
    att_1: { score: '', status: 'ABSENT' },
    att_2: { score: 24, status: 'MARKED' }
  };
  const res5B = MarksCalculationEngine.aggregateAttempts({ attempts: attempts2, scores: scores5B });
  assert.strictEqual(res5B.aggregatedScore, 24, 'AB + 24 must average to 24 (denominator = 1)');
  console.log('  ✓ Test 1 = AB, Test 2 = 24 correctly produces average 24');

  // Case 5C: All AB (Test 1 = AB, Test 2 = AB) -> status = 'ABSENT', score = null, displayText = 'AB'
  const scores5C = {
    att_1: { score: '', status: 'ABSENT' },
    att_2: { score: '', status: 'ABSENT' }
  };
  const res5C = MarksCalculationEngine.aggregateAttempts({ attempts: attempts2, scores: scores5C });
  assert.strictEqual(res5C.aggregatedScore, null, 'All AB must not produce a numeric score');
  assert.strictEqual(res5C.status, 'ABSENT');
  assert.strictEqual(res5C.displayText, 'AB');
  console.log('  ✓ All AB attempts correctly preserve status ABSENT and display "AB" (NOT zero)');

  // ----------------------------------------------------
  // TEST 6: Not Applicable (NA) Handling
  // ----------------------------------------------------
  console.log('\nTest 6: Not Applicable (NA) Handling');
  // Case 6A: Test 1 = NA, Test 2 = 24 -> Average = 24
  const scores6A = {
    att_1: { score: '', status: 'NOT_APPLICABLE' },
    att_2: { score: 24, status: 'MARKED' }
  };
  const res6A = MarksCalculationEngine.aggregateAttempts({ attempts: attempts2, scores: scores6A });
  assert.strictEqual(res6A.aggregatedScore, 24, 'NA + 24 must produce 24');
  assert.strictEqual(res6A.naCount, 1);
  console.log('  ✓ Test 1 = NA, Test 2 = 24 correctly produces average 24');

  // Case 6B: Test 1 = AB, Test 2 = NA -> No numeric attempt -> score = null, displayText = '—'
  const scores6B = {
    att_1: { score: '', status: 'ABSENT' },
    att_2: { score: '', status: 'NOT_APPLICABLE' }
  };
  const res6B = MarksCalculationEngine.aggregateAttempts({ attempts: attempts2, scores: scores6B });
  assert.strictEqual(res6B.aggregatedScore, null);
  assert.strictEqual(res6B.displayText, '—');
  console.log('  ✓ Test 1 = AB, Test 2 = NA correctly displays "—" without silent conversion to zero');

  // ----------------------------------------------------
  // TEST 7: Decimal Precision & Rounding Rules
  // ----------------------------------------------------
  console.log('\nTest 7: Decimal Precision & Rounding Policy Consistency');
  // 18 + 22 + 24 = 64 / 3 = 21.333333...
  const scores7 = {
    att_1: { score: 18, status: 'MARKED' },
    att_2: { score: 22, status: 'MARKED' },
    att_3: { score: 24, status: 'MARKED' }
  };

  const res7_2dec = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores7, roundingRule: 'ROUND_2_DECIMALS' });
  assert.strictEqual(res7_2dec.aggregatedScore, 21.33, '64/3 rounded to 2 decimals should be 21.33');
  assert.strictEqual(res7_2dec.displayText, '21.33');

  const res7_int = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores7, roundingRule: 'ROUND_NEAREST_INTEGER' });
  assert.strictEqual(res7_int.aggregatedScore, 21, '64/3 rounded to nearest integer should be 21');
  assert.strictEqual(res7_int.displayText, '21');

  const res7_1dec = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores7, roundingRule: 'ROUND_1_DECIMAL' });
  assert.strictEqual(res7_1dec.aggregatedScore, 21.3, '64/3 rounded to 1 decimal should be 21.3');
  console.log('  ✓ Rounding rules verified (21.33 for ROUND_2_DECIMALS, 21 for ROUND_NEAREST_INTEGER, 21.3 for ROUND_1_DECIMAL)');

  // ----------------------------------------------------
  // TEST 8: Mark Bounds Validation
  // ----------------------------------------------------
  console.log('\nTest 8: Input Bounds Validation');
  const vValid = MarksCalculationEngine.validateAttemptMark('24', 25);
  assert.strictEqual(vValid.isValid, true);
  assert.strictEqual(vValid.normalizedValue, 24);

  const vAbove = MarksCalculationEngine.validateAttemptMark('26', 25);
  assert.strictEqual(vAbove.isValid, false, 'Mark 26 exceeds max 25');

  const vNegative = MarksCalculationEngine.validateAttemptMark('-1', 25);
  assert.strictEqual(vNegative.isValid, false, 'Mark cannot be negative');

  const vAB = MarksCalculationEngine.validateAttemptMark('AB', 25);
  assert.strictEqual(vAB.isValid, true);
  assert.strictEqual(vAB.status, 'ABSENT');

  const vNA = MarksCalculationEngine.validateAttemptMark('NA', 25);
  assert.strictEqual(vNA.isValid, true);
  assert.strictEqual(vNA.status, 'NOT_APPLICABLE');
  console.log('  ✓ Bounds validation verified: 26 rejected, -1 rejected, 24 accepted, AB/NA handled');

  // ----------------------------------------------------
  // TEST 9: End-to-End Downstream Total Calculation
  // ----------------------------------------------------
  console.log('\nTest 9: End-to-End Assessment Integration (Section 30 Scenario)');
  // Student: Muzzammil Aftab
  // Weekly Tests: Test 1 = 20/25, Test 2 = 24/25 -> Average = 22/25
  // Term Exam: Raw = 80/100 -> Converted = 80 * 75 / 100 = 60/75
  // Final Total: 22 + 60 = 82/100 -> Grade: A
  const patternSenior = {
    rounding_rule: 'ROUND_2_DECIMALS',
    grade_boundaries: [
      { grade_name: 'A*', min_percentage: 90.00, max_percentage: 100.00 },
      { grade_name: 'A', min_percentage: 80.00, max_percentage: 89.99 },
      { grade_name: 'B', min_percentage: 70.00, max_percentage: 79.99 },
      { grade_name: 'C', min_percentage: 60.00, max_percentage: 69.99 },
      { grade_name: 'D', min_percentage: 40.00, max_percentage: 59.99 },
      { grade_name: 'E', min_percentage: 0.00, max_percentage: 39.99 }
    ]
  };

  const componentsSenior = [
    { id: 'c-test', component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: 25, converted_max_marks: 25, contributes_to_total: true },
    { id: 'c-exam', component_code: 'EXAM', component_name: 'Term Examination', raw_max_marks: 100, converted_max_marks: 75, contributes_to_total: true }
  ];

  // The calculated Weekly Test average (22) feeds into the official Weekly Test mark
  const rawScoresMuza = {
    TEST: res2.aggregatedScore, // 22
    EXAM: 80
  };
  const statusesMuza = {
    TEST: 'MARKED',
    EXAM: 'MARKED'
  };

  const studentResult = MarksCalculationEngine.calculateStudentResult({
    components: componentsSenior,
    rawScores: rawScoresMuza,
    statuses: statusesMuza,
    gradeBoundaries: patternSenior.grade_boundaries,
    roundingRule: patternSenior.rounding_rule
  });

  assert.strictEqual(studentResult.totalConverted, 82, 'Weekly Test 22 + Exam Converted 60 must equal 82');
  assert.strictEqual(studentResult.maxPossibleConverted, 100, 'Max possible converted should be 100');
  assert.strictEqual(studentResult.percentage, 82, 'Percentage should be 82%');
  assert.strictEqual(studentResult.grade, 'A', 'Grade should be A');
  console.log('  ✓ Section 30 Scenario Verified: Weekly Avg (22) + Converted Exam (60) = 82/100 -> Grade A');

  // ----------------------------------------------------
  // TEST 10: Section 31 Scenario (Three Tests)
  // ----------------------------------------------------
  console.log('\nTest 10: Section 31 Scenario (Three Tests: 18 + 21 + 24 = 21, Exam 72 -> 54 = 75/100)');
  const rawScoresSec31 = {
    TEST: res3.aggregatedScore, // 21
    EXAM: 72
  };
  const resultSec31 = MarksCalculationEngine.calculateStudentResult({
    components: componentsSenior,
    rawScores: rawScoresSec31,
    statuses: { TEST: 'MARKED', EXAM: 'MARKED' },
    gradeBoundaries: patternSenior.grade_boundaries,
    roundingRule: patternSenior.rounding_rule
  });

  assert.strictEqual(resultSec31.totalConverted, 75, '21 + (72 * 75 / 100 = 54) must equal 75');
  assert.strictEqual(resultSec31.percentage, 75);
  assert.strictEqual(resultSec31.grade, 'B');
  console.log('  ✓ Section 31 Scenario Verified: Weekly Avg (21) + Converted Exam (54) = 75/100 -> Grade B');

  // ----------------------------------------------------
  // TEST 11: Extensibility for Other Aggregation Methods
  // ----------------------------------------------------
  console.log('\nTest 11: Extensible Aggregation Methods (BEST, LATEST, SUM)');
  const aggBest = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores3, aggregationMethod: 'BEST' });
  assert.strictEqual(aggBest.aggregatedScore, 24, 'BEST of 18, 21, 24 should be 24');

  const aggLatest = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores3, aggregationMethod: 'LATEST' });
  assert.strictEqual(aggLatest.aggregatedScore, 24, 'LATEST of 18, 21, 24 should be 24');

  const aggSum = MarksCalculationEngine.aggregateAttempts({ attempts: attempts3, scores: scores3, aggregationMethod: 'SUM' });
  assert.strictEqual(aggSum.aggregatedScore, 63, 'SUM of 18, 21, 24 should be 63');
  console.log('  ✓ Future aggregation methods (BEST=24, LATEST=24, SUM=63) verified');

  console.log('\n================================================================');
  console.log('ALL 11 TEST MODULES PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
