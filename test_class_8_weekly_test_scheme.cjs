// test_class_8_weekly_test_scheme.cjs
// Verification Suite for Class 8 Weekly Test max marks = 20 (not 25)

const assert = require('assert');

async function run() {
  console.log('================================================================');
  console.log('TEST SUITE: CLASS 8 WEEKLY TEST MAX MARKS = 20');
  console.log('================================================================\n');

  const { MarksCalculationEngine, getClassWeeklyTestMaxMarks } = await import('./src/services/MarksCalculationEngine.js');

  // Test 1: Class 8 in all Arabic and Roman variations resolves to 20
  console.log('Test 1: Class 8 variations scale verification');
  const class8Variations = [
    '8', '8A', '8B', '8-A', '8-B', '8 A', '8 B',
    'Class 8', 'Class 8A', 'Class 8B', 'Class 8 A', 'Class 8 B', 'Class 8-A', 'Class 8-B',
    'VIII', 'VIIIA', 'VIIIB', 'VIII-A', 'VIII-B',
    'Class VIII', 'Class VIIIA', 'Class VIIIB', 'Class VIII A', 'Class VIII B', 'Class VIII-A', 'Class VIII-B',
    { name: '8', section: 'A' },
    { name: 'Class 8', section: 'B' },
    { className: '8' }
  ];

  class8Variations.forEach(v => {
    const val = typeof v === 'object' ? `${v.name || v.className} ${v.section || ''}` : v;
    const max = getClassWeeklyTestMaxMarks(v);
    assert.strictEqual(max, 20, `Input "${val}" must resolve to 20, but got ${max}`);
  });
  console.log(`  ✓ All ${class8Variations.length} variations of Class 8 strictly resolve to 20 marks!`);

  // Test 2: Classes 5 to 7 resolve to 25
  console.log('\nTest 2: Classes 5–7 variations resolve to 25');
  const class5to7Variations = [
    '5', 'Class 5', 'Class 5 A', 'Class 5 B', 'V', 'Class V',
    '6', 'Class 6', 'Class 6 A', 'Class 6 B', 'VI', 'Class VI',
    '7', 'Class 7', 'Class 7 A', 'Class 7 B', 'VII', 'Class VII'
  ];
  class5to7Variations.forEach(v => {
    const max = getClassWeeklyTestMaxMarks(v);
    assert.strictEqual(max, 25, `Input "${v}" must resolve to 25, but got ${max}`);
  });
  console.log(`  ✓ All ${class5to7Variations.length} variations of Classes 5–7 strictly resolve to 25 marks!`);

  // Test 3: Classes 9 to 12 resolve to 20
  console.log('\nTest 3: Classes 9–12 variations resolve to 20');
  const class9to12Variations = [
    '9', 'Class 9', 'Class 9 A', 'IX', 'Class IX',
    '10', 'Class 10', 'Class 10 B', 'X', 'Class X',
    '11', 'Class 11', 'Class 11 Science', 'XI', 'Class XI',
    '12', 'Class 12', 'Class 12 Arts', 'XII', 'Class XII'
  ];
  class9to12Variations.forEach(v => {
    const max = getClassWeeklyTestMaxMarks(v);
    assert.strictEqual(max, 20, `Input "${v}" must resolve to 20, but got ${max}`);
  });
  console.log(`  ✓ All ${class9to12Variations.length} variations of Classes 9–12 strictly resolve to 20 marks!`);

  // Test 4: Pattern resolution for Class 8
  console.log('\nTest 4: Dynamic Assessment Pattern Resolution for Class 8');
  const patterns = [
    {
      id: 'p-5-7',
      pattern_name: 'Senior School (Classes 5-7) Scheme',
      class_group: 'SENIOR_5_8',
      applicable_classes: ['Class 5', 'Class 6', 'Class 7', 'Class 5 A', 'Class 5 B', 'Class 6 A', 'Class 6 B', 'Class 7 A', 'Class 7 B'],
      status: 'ACTIVE',
      components: [
        { component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: 25, converted_max_marks: 25 },
        { component_code: 'EXAM', component_name: 'Term Examination', raw_max_marks: 100, converted_max_marks: 75 }
      ]
    },
    {
      id: 'p-8',
      pattern_name: 'Senior School (Class 8) Scheme',
      class_group: 'SENIOR_5_8',
      applicable_classes: ['Class 8', 'Class 8 A', 'Class 8 B', '8', '8 A', '8 B'],
      status: 'ACTIVE',
      components: [
        { component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: 20, converted_max_marks: 20 },
        { component_code: 'EXAM', component_name: 'Term Examination', raw_max_marks: 100, converted_max_marks: 80 }
      ]
    }
  ];

  const resolved8 = MarksCalculationEngine.resolvePattern('Class 8', '2026', patterns);
  assert.strictEqual(resolved8.id, 'p-8', 'Class 8 must resolve to Senior School (Class 8) Scheme');
  const testComp8 = resolved8.components.find(c => c.component_code === 'TEST');
  assert.strictEqual(testComp8.raw_max_marks, 20, 'Class 8 Weekly Test raw max marks must be 20');
  assert.strictEqual(testComp8.converted_max_marks, 20, 'Class 8 Weekly Test converted max marks must be 20');
  console.log('  ✓ Class 8 resolves to Senior School (Class 8) Scheme with Weekly Test max marks = 20!');

  const resolved8A = MarksCalculationEngine.resolvePattern('8 A', '2026', patterns);
  assert.strictEqual(resolved8A.id, 'p-8', '8 A must resolve to Senior School (Class 8) Scheme');
  console.log('  ✓ "8 A" resolves to Senior School (Class 8) Scheme!');

  const resolved6 = MarksCalculationEngine.resolvePattern('Class 6 A', '2026', patterns);
  assert.strictEqual(resolved6.id, 'p-5-7', 'Class 6 A must resolve to Senior School (Classes 5-7) Scheme');
  const testComp6 = resolved6.components.find(c => c.component_code === 'TEST');
  assert.strictEqual(testComp6.raw_max_marks, 25, 'Class 6 Weekly Test raw max marks must be 25');
  console.log('  ✓ Class 6 A resolves to Senior School (Classes 5-7) Scheme with Weekly Test max marks = 25!');

  // Test 5: Score calculation with Class 8 Weekly Test (20) + Term Exam (80)
  console.log('\nTest 5: Student score calculation with Class 8 Scheme (20/80)');
  const scores = {
    TEST: { rawScore: 18, status: 'MARKED' }, // 18/20
    EXAM: { rawScore: 85, status: 'MARKED' }  // 85/100 -> converted to 68/80
  };
  const result = MarksCalculationEngine.calculateStudentScores(resolved8.components, scores, resolved8);
  assert.strictEqual(result.totalMarks, 86, '18 + 68 = 86 marks');
  assert.strictEqual(result.maxTotal, 100, 'Total maximum marks must be 100');
  assert.strictEqual(result.percentage, 86, 'Percentage must be 86%');
  console.log('  ✓ Score calculation: Test 18/20 + Exam 85/100 (68/80) = 86/100 (86%) verified!');

  console.log('\n================================================================');
  console.log('ALL CLASS 8 ASSESSMENT TESTS PASSED SUCCESSFULLY! (5/5)');
  console.log('================================================================');
}

run().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
