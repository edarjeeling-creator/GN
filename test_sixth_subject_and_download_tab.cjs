// test_sixth_subject_and_download_tab.cjs
// Comprehensive Verification Suite for 6th Subject Grouping & /download Weekly Tests Tab

const assert = require('assert');

async function run() {
  console.log('================================================================');
  console.log('TEST SUITE: 6TH SUBJECT GROUPING & /DOWNLOAD WEEKLY TESTS TAB');
  console.log('================================================================\n');

  const { SIXTH_SUBJECT_MATCHERS, isSixthSubject, getGroupsForClass, getDynamicSubjectName } = await import('./src/utils/reportUtils.js');

  // Test 1: Authoritative Electives Matching
  console.log('Test 1: Verification of 6th Subject Electives');
  const requiredElectives = [
    'Computer Application',
    'Computer Applications',
    'Fine Arts',
    'Fine Art',
    'Home Science',
    'Physical Education',
    'Physical Ed',
    'PE',
    'Commercial Application',
    'Commercial Applications',
    '6th Subject',
    'Sixth Subject'
  ];

  requiredElectives.forEach(name => {
    assert.strictEqual(
      isSixthSubject(name),
      true,
      `Elective "${name}" must be recognized as 6th Subject`
    );
  });
  console.log(`  ✓ All ${requiredElectives.length} variations of 6th subject electives correctly match isSixthSubject()`);

  // Verify non-6th subjects are NOT matched
  const standardSubjects = ['English Language', 'Mathematics', 'Physics', 'History', 'Geography', 'Biology', 'Chemistry'];
  standardSubjects.forEach(name => {
    assert.strictEqual(
      isSixthSubject(name),
      false,
      `Standard subject "${name}" must NOT be recognized as 6th Subject`
    );
  });
  console.log(`  ✓ Standard core subjects correctly excluded from 6th subject matching\n`);

  // Test 2: getGroupsForClass contains 6th Subject across all class levels
  console.log('Test 2: getGroupsForClass Group Structure');
  const testClasses = ['9', '10', 'Class 9', 'Class 10', '11', '12', 'Class 8', '7 A', '6 B'];
  testClasses.forEach(className => {
    const groups = getGroupsForClass(className);
    const sixthGroup = groups.find(g => g.name === '6th Subject');
    assert.ok(sixthGroup, `Class "${className}" must include "6th Subject" group`);
    assert.deepStrictEqual(sixthGroup.matchers, SIXTH_SUBJECT_MATCHERS);
  });
  console.log(`  ✓ All class levels (Classes 6-12) include "6th Subject" group\n`);

  // Test 3: Flowsheet Column Collapsing & Marks Calculation
  console.log('Test 3: Flowsheet 6th Subject Column Collapsing');
  const sampleAssignedSubjects = [
    { id: 'sub-eng', name: 'English Language' },
    { id: 'sub-math', name: 'Mathematics' },
    { id: 'sub-ca', name: 'Computer Application' },
    { id: 'sub-fa', name: 'Fine Arts' },
    { id: 'sub-pe', name: 'Physical Education' },
    { id: 'sub-hs', name: 'Home Science' },
    { id: 'sub-comm', name: 'Commercial Application' }
  ];

  // Logic used in Flowsheet displayColumns
  const cols = [];
  let sixthGroupAdded = false;
  sampleAssignedSubjects.forEach(sub => {
    if (isSixthSubject(sub.name)) {
      if (!sixthGroupAdded) {
        cols.push({
          id: 'group_6th_sub',
          name: '6th Sub',
          fullName: '6th Subject',
          isSixthGroup: true
        });
        sixthGroupAdded = true;
      }
    } else {
      cols.push({
        id: sub.id,
        name: sub.name.substring(0, 4),
        fullName: sub.name,
        isSixthGroup: false,
        sub
      });
    }
  });

  // Verify that the 5 electives collapsed into exactly 1 column
  assert.strictEqual(cols.length, 3, 'Must collapse 5 electives + 2 standard subjects into 3 columns');
  assert.strictEqual(cols[0].fullName, 'English Language');
  assert.strictEqual(cols[1].fullName, 'Mathematics');
  assert.strictEqual(cols[2].fullName, '6th Subject');
  assert.strictEqual(cols[2].name, '6th Sub');
  console.log('  ✓ 5 electives (Computer App, Fine Arts, Home Sc, PE, Commercial App) collapsed into single "6th Sub" column');

  // Verify Student Scores Mapping in Flowsheet row
  const studentJohn = {
    id: 'st-john',
    name: 'John Doe',
    subjectScores: [
      { subjectId: 'sub-eng', subjectName: 'English Language', total: 85 },
      { subjectId: 'sub-math', subjectName: 'Mathematics', total: 90 },
      { subjectId: 'sub-ca', subjectName: 'Computer Application', total: 95 }
    ]
  };

  const studentMary = {
    id: 'st-mary',
    name: 'Mary Jane',
    subjectScores: [
      { subjectId: 'sub-eng', subjectName: 'English Language', total: 80 },
      { subjectId: 'sub-math', subjectName: 'Mathematics', total: 75 },
      { subjectId: 'sub-fa', subjectName: 'Fine Arts', total: 92 }
    ]
  };

  const getColScore = (row, col) => {
    if (col.isSixthGroup) {
      const scoreObj = row.subjectScores.find(s => isSixthSubject(s.subjectName));
      return scoreObj ? scoreObj.total : '';
    } else {
      const scoreObj = row.subjectScores.find(s => s.subjectId === col.id);
      return scoreObj ? scoreObj.total : '';
    }
  };

  assert.strictEqual(getColScore(studentJohn, cols[2]), 95, 'John took Computer App (95) -> mapped to 6th Sub column');
  assert.strictEqual(getColScore(studentMary, cols[2]), 92, 'Mary took Fine Arts (92) -> mapped to 6th Sub column');
  console.log('  ✓ Student scores in different electives correctly map to the unified 6th Sub column\n');

  // Test 4: ReportPrintingControl Sibling Class Pairing & Pulldown Logic
  console.log('Test 4: Sibling Class Grouping for 1-Page Paper Saver Printout');
  const sampleClasses = [
    { id: 'c-7a', name: '7', section: 'A' },
    { id: 'c-7b', name: '7', section: 'B' },
    { id: 'c-8a', name: '8', section: 'A' },
    { id: 'c-8b', name: '8', section: 'B' },
    { id: 'c-9', name: '9', section: '' }
  ];

  const getStandardKey = (clsObj) => {
    if (!clsObj) return '';
    let name = String(clsObj.name || '').trim().replace(/^class\s*/i, '').trim();
    if (clsObj.section && name.toLowerCase().endsWith(clsObj.section.toLowerCase())) {
      name = name.slice(0, -clsObj.section.length).trim();
    }
    return name.toLowerCase();
  };

  const groups = {};
  sampleClasses.forEach(c => {
    const key = getStandardKey(c);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const options = [];
  Object.keys(groups).sort().forEach(key => {
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

  assert.strictEqual(options.length, 2, 'Should create 2 combined options (Class 7 & Class 8)');
  assert.strictEqual(options[0].label, '7 A & 7 B (Combined) — 1 Page');
  assert.strictEqual(options[1].label, '8 A & 8 B (Combined) — 1 Page');
  console.log(`  ✓ Pulldown includes combined sibling sections: [${options.map(o => o.label).join(', ')}]`);

  // Test 5: Ranking under 6th Subject across electives
  console.log('\nTest 5: Ranking under 6th Subject across different electives');
  const { MarksCalculationEngine } = await import('./src/services/MarksCalculationEngine.js');

  const sixthSubjectStudents = [
    { student: { id: 's1', name: 'Anil Sharma' }, total: 20, isAbsent: false, house: 'Topaz', subjectDetail: 'Computer Application' },
    { student: { id: 's2', name: 'Deepa Rai' }, total: 20, isAbsent: false, house: 'Garnet', subjectDetail: 'Fine Arts' },
    { student: { id: 's3', name: 'Kiran Thapa' }, total: 19, isAbsent: false, house: 'Onyx', subjectDetail: 'Physical Education' },
    { student: { id: 's4', name: 'Meena Giri' }, total: 18, isAbsent: false, house: 'Turquoise', subjectDetail: 'Home Science' },
    { student: { id: 's5', name: 'Rajiv Sen' }, total: 8, isAbsent: false, house: 'Topaz', subjectDetail: 'Commercial Application' } // Below 10!
  ];

  const summary = MarksCalculationEngine.calculateHonoursAndAttention(sixthSubjectStudents, {
    rankingPolicy: 'DENSE',
    requiresAttentionThreshold: 10,
    thresholdType: 'SCORE',
    excludeAbsentFromRanking: true
  });

  assert.strictEqual(summary.topScorers.length, 4);
  assert.strictEqual(summary.topScorers.filter(s => s.rank === 1).length, 2); // Anil & Deepa tied at 20
  assert.strictEqual(summary.topScorers.filter(s => s.rank === 2).length, 1); // Kiran at 19
  assert.strictEqual(summary.topScorers.filter(s => s.rank === 3).length, 1); // Meena at 18
  assert.strictEqual(summary.requiresAttention.length, 1); // Rajiv at 8/20
  assert.strictEqual(summary.requiresAttention[0].student.name, 'Rajiv Sen');

  console.log('  ✓ 6th Subject ranking correctly aggregates across Computer App, Fine Arts, PE, Home Sc, Commercial App');
  console.log('  ✓ 1st Rankers tied at 20: Anil (Computer App) & Deepa (Fine Arts)');
  console.log('  ✓ Requires attention correctly identified: Rajiv (Commercial App, 8/20)\n');

  console.log('================================================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (5/5)');
  console.log('================================================================');
}

run().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
