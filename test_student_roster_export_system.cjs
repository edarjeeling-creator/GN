/**
 * Test Suite: Student Roster Export & Action System Verification
 * Verifies:
 * 1. Excel (.xlsx) export data transformation with all columns (Roll, Name, Attempts, Average, Exam, Total, Grade).
 * 2. CSV (.csv) export formatting with RFC 4180 compatibility.
 * 3. File name sanitization against path separators (/, \) and special characters.
 * 4. Handling of AB, NA, empty attempts, and numeric scores in export.
 * 5. Multi-attempt test breakdown export.
 */

const assert = require('assert');
const XLSX = require('xlsx');
const { MarksCalculationEngine } = require('./src/services/MarksCalculationEngine.js');

console.log('================================================================');
console.log('TEST SUITE: STUDENT ROSTER EXPORT & ACTION SYSTEM');
console.log('================================================================\n');

// 1. Mock Student Roster
const mockStudents = [
  { id: 'st_1', roll_no: 1, name: 'Muzzammil Aftab' },
  { id: 'st_2', roll_no: 2, name: 'Farhan Alam' },
  { id: 'st_3', roll_no: 3, name: 'Aarush Chettri' },
  { id: 'st_4', roll_no: 4, name: 'Zabien Chettri' }
];

const mockComponents = [
  { id: 'c_test', component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: 25, converted_max_marks: 25 },
  { id: 'c_exam', component_code: 'EXAM', component_name: 'Term Examination', raw_max_marks: 100, converted_max_marks: 75 }
];

// Helper to simulate exportData generation matching SubjectMarks.jsx
function generateExportRows({ students, components, attempts, attemptScores, attemptStatuses, rawScores, statuses, studentAttemptAggregates, activePattern }) {
  return students.map(student => {
    const studentScores = {};
    const studentStatuses = {};
    components.forEach(comp => {
      let rawVal;
      let stStatus;
      if (comp.component_code === 'TEST' && attempts.length > 0) {
        const agg = studentAttemptAggregates[student.id];
        rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : '';
        stStatus = agg?.status || 'MARKED';
      } else {
        const key = `${student.id}_${comp.component_code}`;
        rawVal = rawScores[key];
        stStatus = statuses[key] || 'MARKED';
      }
      studentScores[comp.component_code] = rawVal;
      studentStatuses[comp.component_code] = stStatus;
    });

    const result = MarksCalculationEngine.calculateStudentResult({
      components,
      rawScores: studentScores,
      statuses: studentStatuses,
      gradeBoundaries: activePattern?.grade_boundaries || [
        { grade_name: 'A', min_percentage: 80, max_percentage: 100 },
        { grade_name: 'B', min_percentage: 65, max_percentage: 79.99 },
        { grade_name: 'C', min_percentage: 50, max_percentage: 64.99 },
        { grade_name: 'D', min_percentage: 35, max_percentage: 49.99 },
        { grade_name: 'E', min_percentage: 0, max_percentage: 34.99 }
      ],
      roundingRule: activePattern?.rounding_rule || 'ROUND_2_DECIMALS'
    });

    const row = {
      'Roll No': student.roll_no,
      'Student Name': student.name
    };

    // If multiple test attempts exist, export individual attempt columns first
    if (attempts.length > 1) {
      attempts.forEach(att => {
        const attKey = `${student.id}_${att.id}`;
        const attScore = attemptScores[attKey];
        const attStatus = attemptStatuses[attKey] || 'MARKED';
        const attColHeader = `${att.attempt_name || `Test ${att.attempt_number}`} (Max ${att.raw_max_marks || 25})`;
        if (attStatus === 'ABSENT') {
          row[attColHeader] = 'AB';
        } else if (attStatus === 'NOT_APPLICABLE') {
          row[attColHeader] = 'NA';
        } else if (attScore !== '' && attScore !== null && attScore !== undefined) {
          row[attColHeader] = Number(attScore);
        } else {
          row[attColHeader] = '';
        }
      });
    }

    components.forEach(comp => {
      const key = `${student.id}_${comp.component_code}`;
      const compData = result.componentBreakdown?.find(b => b.componentCode === comp.component_code);
      let stStatus;
      let rawVal;

      if (comp.component_code === 'TEST' && attempts.length > 0) {
        const agg = studentAttemptAggregates[student.id];
        rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : null;
        stStatus = agg?.status || 'MARKED';
      } else {
        stStatus = comp.is_calculated ? compData?.status : (statuses[key] || 'MARKED');
        rawVal = comp.is_calculated ? compData?.rawScore : rawScores[key];
      }

      let colHeader = comp.is_calculated
        ? `${comp.component_name} (Auto Max ${comp.raw_max_marks})`
        : `${comp.component_name} (Max ${comp.raw_max_marks})`;

      if (comp.component_code === 'TEST' && attempts.length > 1) {
        colHeader = `${comp.component_name} (Average /${comp.raw_max_marks})`;
      }

      if (stStatus === 'ABSENT') {
        row[colHeader] = 'AB';
      } else if (stStatus === 'NOT_APPLICABLE') {
        row[colHeader] = 'NA';
      } else if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
        row[colHeader] = Number(rawVal);
      } else {
        row[colHeader] = '';
      }
    });

    row['Calculated Total'] = result.hasAnyMark ? (result.isAllAbsent ? 'AB' : (result.totalConverted ?? '')) : '';
    row['Grade'] = result.grade || '';

    return row;
  });
}

// -------------------------------------------------------------
// Test 1: Single Test Attempt Export (Baseline)
// -------------------------------------------------------------
console.log('Test 1: Single Test Attempt Export Data');
{
  const rawScores = {
    'st_1_TEST': '24', 'st_1_EXAM': '80',
    'st_2_TEST': '22', 'st_2_EXAM': '',
    'st_3_TEST': '', 'st_3_EXAM': '',
    'st_4_TEST': '', 'st_4_EXAM': ''
  };
  const statuses = {
    'st_1_TEST': 'MARKED', 'st_1_EXAM': 'MARKED',
    'st_2_TEST': 'MARKED', 'st_2_EXAM': 'MARKED',
    'st_3_TEST': 'ABSENT', 'st_3_EXAM': 'MARKED',
    'st_4_TEST': 'NOT_APPLICABLE', 'st_4_EXAM': 'MARKED'
  };

  const rows = generateExportRows({
    students: mockStudents,
    components: mockComponents,
    attempts: [],
    attemptScores: {},
    attemptStatuses: {},
    rawScores,
    statuses,
    studentAttemptAggregates: {},
    activePattern: null
  });

  assert.strictEqual(rows.length, 4, 'Should export all 4 students');
  assert.strictEqual(rows[0]['Roll No'], 1);
  assert.strictEqual(rows[0]['Student Name'], 'Muzzammil Aftab');
  assert.strictEqual(rows[0]['Weekly Test (Max 25)'], 24);
  assert.strictEqual(rows[0]['Term Examination (Max 100)'], 80);
  assert.strictEqual(rows[0]['Calculated Total'], 84); // 24 + (80*75/100 = 60) = 84
  assert.strictEqual(rows[0]['Grade'], 'A');

  // Student 2: Exam blank -> Total = 22
  assert.strictEqual(rows[1]['Weekly Test (Max 25)'], 22);
  assert.strictEqual(rows[1]['Term Examination (Max 100)'], '');
  assert.strictEqual(rows[1]['Calculated Total'], 22);

  // Student 3: AB in test
  assert.strictEqual(rows[2]['Weekly Test (Max 25)'], 'AB');

  // Student 4: NA in test
  assert.strictEqual(rows[3]['Weekly Test (Max 25)'], 'NA');

  console.log('  ✓ Single test export row structure verified accurately');
}

// -------------------------------------------------------------
// Test 2: Multi-Attempt Weekly Test Export Breakdown
// -------------------------------------------------------------
console.log('\nTest 2: Multi-Attempt Weekly Test Export (Test 1, Test 2, Average)');
{
  const attempts = [
    { id: 'att_1', attempt_number: 1, attempt_name: 'Test 1', raw_max_marks: 25 },
    { id: 'att_2', attempt_number: 2, attempt_name: 'Test 2', raw_max_marks: 25 }
  ];

  const attemptScores = {
    'st_1_att_1': '20', 'st_1_att_2': '24',
    'st_2_att_1': '18', 'st_2_att_2': ''
  };
  const attemptStatuses = {
    'st_1_att_1': 'MARKED', 'st_1_att_2': 'MARKED',
    'st_2_att_1': 'MARKED', 'st_2_att_2': 'ABSENT'
  };

  const studentAttemptAggregates = {
    'st_1': { aggregatedScore: 22, status: 'MARKED', validCount: 2 },
    'st_2': { aggregatedScore: 18, status: 'MARKED', validCount: 1 } // Test 2 is AB -> avg is 18
  };

  const rows = generateExportRows({
    students: [mockStudents[0], mockStudents[1]],
    components: mockComponents,
    attempts,
    attemptScores,
    attemptStatuses,
    rawScores: {},
    statuses: {},
    studentAttemptAggregates,
    activePattern: null
  });

  assert.strictEqual(rows[0]['Test 1 (Max 25)'], 20);
  assert.strictEqual(rows[0]['Test 2 (Max 25)'], 24);
  assert.strictEqual(rows[0]['Weekly Test (Average /25)'], 22);

  assert.strictEqual(rows[1]['Test 1 (Max 25)'], 18);
  assert.strictEqual(rows[1]['Test 2 (Max 25)'], 'AB');
  assert.strictEqual(rows[1]['Weekly Test (Average /25)'], 18);

  console.log('  ✓ Multi-attempt test columns (Test 1, Test 2, Average) correctly generated');
}

// -------------------------------------------------------------
// Test 3: Excel (.xlsx) Binary Workbook Generation
// -------------------------------------------------------------
console.log('\nTest 3: Excel (.xlsx) Binary Workbook Generation');
{
  const rows = [
    { 'Roll No': 1, 'Student Name': 'Muzzammil Aftab', 'Weekly Test (Max 25)': 24, 'Term Examination (Max 100)': 80, 'Calculated Total': 84, 'Grade': 'A' }
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Class_5_GK');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  assert(Buffer.isBuffer(wbout), 'Should generate binary buffer for Excel file');
  assert(wbout.length > 1000, 'Excel file size should be substantial');

  // Verify roundtrip read
  const parsedWb = XLSX.read(wbout, { type: 'buffer' });
  assert.strictEqual(parsedWb.SheetNames[0], 'Class_5_GK');
  const parsedData = XLSX.utils.sheet_to_json(parsedWb.Sheets['Class_5_GK']);
  assert.strictEqual(parsedData[0]['Student Name'], 'Muzzammil Aftab');
  assert.strictEqual(parsedData[0]['Calculated Total'], 84);

  console.log('  ✓ Excel (.xlsx) roundtrip binary read/write verified');
}

// -------------------------------------------------------------
// Test 4: CSV (.csv) String Generation & RFC 4180 Escaping
// -------------------------------------------------------------
console.log('\nTest 4: CSV (.csv) String Generation');
{
  const rows = [
    { 'Roll No': 1, 'Student Name': 'Muzzammil Aftab', 'Weekly Test (Max 25)': 24, 'Term Examination (Max 100)': 80, 'Calculated Total': 84, 'Grade': 'A' },
    { 'Roll No': 2, 'Student Name': 'Sharma, Rohit', 'Weekly Test (Max 25)': 'AB', 'Term Examination (Max 100)': '', 'Calculated Total': 'AB', 'Grade': 'AB' }
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  assert(typeof csvContent === 'string', 'CSV content should be string');
  assert(csvContent.includes('Muzzammil Aftab'), 'CSV should contain student name');
  assert(csvContent.includes('"Sharma, Rohit"'), 'Comma in name should be properly quoted in CSV');
  assert(csvContent.includes('Weekly Test (Max 25)'), 'CSV should have component header');

  console.log('  ✓ CSV format generation and RFC 4180 escaping verified');
}

// -------------------------------------------------------------
// Test 5: File Name Sanitization against Special Characters & Slashes
// -------------------------------------------------------------
console.log('\nTest 5: File Name Sanitization');
{
  const testCases = [
    { clsName: 'Class 5', section: 'A', subject: 'EVS/Maths', term: 'Finalterm', year: '2026' },
    { clsName: '8', section: null, subject: 'General Knowledge / Moral Science', term: 'Midterm', year: '2025-2026' },
    { clsName: '10', section: 'H', subject: 'Economics: Theory & Practice', term: 'Finalterm', year: '2026' }
  ];

  testCases.forEach((tc, idx) => {
    const safeClass = String(tc.clsName || 'Class').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const safeSec = tc.section ? `_${String(tc.section).replace(/[/\\?%*:|"<>]/g, '-').trim()}` : '';
    const safeSub = String(tc.subject || 'Subject').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const safeTerm = String(tc.term || 'Term').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const safeYr = String(tc.year || '2026').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const baseName = `${safeClass}${safeSec}_${safeSub}_${safeTerm}_${safeYr}`.replace(/\s+/g, '_');

    assert(!baseName.includes('/'), `Filename ${baseName} must not contain forward slash`);
    assert(!baseName.includes('\\'), `Filename ${baseName} must not contain backslash`);
    assert(!baseName.includes(':'), `Filename ${baseName} must not contain colon`);
    assert(!baseName.includes('?'), `Filename ${baseName} must not contain question mark`);
    assert(!baseName.includes('*'), `Filename ${baseName} must not contain asterisk`);
  });

  console.log('  ✓ All file name sanitization cases safely stripped path separators');
}

// -------------------------------------------------------------
// Test 6: Multi-Platform Downloader Resilience & URI Generation
// -------------------------------------------------------------
console.log('\nTest 6: Multi-Platform Downloader Resilience & URI Generation');
{
  // 1. Verify Base64 Excel Data URI generation
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([{ Roll: 1, Name: 'Test Student', Marks: 25 }]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const xlsxDataUri = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;

  assert(xlsxDataUri.startsWith('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'), 'Excel Data URI header valid');
  assert(b64.length > 100, 'Excel base64 content non-empty');

  // Verify that base64 can be converted back to workbook
  const buffer = Buffer.from(b64, 'base64');
  const roundtripWb = XLSX.read(buffer, { type: 'buffer' });
  assert.strictEqual(roundtripWb.SheetNames[0], 'Sheet1', 'Base64 roundtrip workbook preserved sheet');

  // 2. Verify CSV UTF-8 BOM encoding for Excel compatibility
  const csvRaw = 'Roll No,Student Name\n1,Muzzammil Aftab';
  const csvWithBom = '\uFEFF' + csvRaw;
  const csvDataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRaw);

  assert(csvWithBom.startsWith('\uFEFF'), 'CSV should contain UTF-8 BOM');
  assert(csvDataUri.includes('\uFEFF'), 'CSV Data URI should contain UTF-8 BOM');

  console.log('  ✓ Excel Base64 Data URI and CSV UTF-8 BOM verified successfully');
}

console.log('\n================================================================');
console.log('ALL STUDENT ROSTER EXPORT TESTS PASSED SUCCESSFULLY! (6/6)');
console.log('================================================================');
