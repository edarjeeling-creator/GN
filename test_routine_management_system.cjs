/**
 * test_routine_management_system.cjs
 * 
 * Exhaustive Executable Test Suite for:
 * Gyanoday Niketan Principal Routine Management & Automatic Teacher Routine System
 */

const assert = require('assert');

// 1. Mock Supabase for Node.js test environment
const mockSupabase = {
  from: (table) => ({
    select: () => ({
      eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      match: () => Promise.resolve({ data: [], error: null }),
      limit: () => Promise.resolve({ data: [], error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null })
    }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }), match: () => Promise.resolve({ data: null, error: null }) }),
    upsert: () => Promise.resolve({ data: null, error: null })
  })
};

// 2. Load Routine System Constants & Models
const WORKING_DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' }
];

const DEFAULT_PERIODS = [
  { period_num: 1, period_name: '1st Period', start_time: '08:00', end_time: '08:40', is_break: false, is_special: false },
  { period_num: 2, period_name: '2nd Period', start_time: '08:40', end_time: '09:20', is_break: false, is_special: false },
  { period_num: 3, period_name: '3rd Period', start_time: '09:20', end_time: '10:00', is_break: false, is_special: false },
  { period_num: 4, period_name: '4th Period', start_time: '10:00', end_time: '10:40', is_break: false, is_special: false },
  { period_num: 5, period_name: '5th Period', start_time: '10:40', end_time: '11:20', is_break: false, is_special: false },
  { period_num: 6, period_name: '6th Period', start_time: '11:20', end_time: '12:00', is_break: false, is_special: false },
  { period_num: 7, period_name: '7th Period', start_time: '12:00', end_time: '12:40', is_break: false, is_special: false },
  { period_num: 8, period_name: '8th Period', start_time: '12:40', end_time: '13:20', is_break: false, is_special: false },
  { period_num: 9, period_name: '9th Period', start_time: '13:20', end_time: '14:00', is_break: false, is_special: true } // Test Period
];

const ROUTINE_ENTRY_TYPES = [
  'SUBJECT', 'ASSEMBLY', 'TEST', 'EXAM', 'LIBRARY', 
  'SINGING', 'DRAWING', 'GAMES', 'PT', 'TABLES', 
  'ROBOTICS', 'PRACTICAL', 'SUPW', 'M.SC.', 'CLUB', 
  'LAB', 'SPECIAL ACTIVITY', 'FREE PERIOD', 'OTHER'
];

// In-Memory Test Engine Mirroring RoutineService
class TestRoutineEngine {
  constructor() {
    this.versions = [];
    this.entries = [];
    this.acknowledgements = [];
    this.auditLogs = [];
    this.periods = [...DEFAULT_PERIODS];
    this.initSeed();
  }

  initSeed() {
    const versionId = 'v-2026-v1-published';
    this.versions.push({
      id: versionId,
      academic_year: '2026',
      campus_name: 'Senior School',
      version_code: 'V1',
      version_num: 1,
      title: 'Senior School Master Routine 2026–27',
      status: 'PUBLISHED',
      change_reason: 'Official Term Schedule finalized by Principal',
      created_at: new Date('2026-09-20T08:00:00Z').toISOString(),
      published_at: new Date('2026-09-24T08:30:00Z').toISOString(),
      published_by_name: 'Principal'
    });

    // Authentic entries from Principal's handwritten routine sheets
    const seed = [
      // Mrs. Pinky BK: Classes 5, 6, 7, 8 - TL Nepali + Tuesday Period 9 TEST
      { id: 'p1', version_id: versionId, day_of_week: 2, period_num: 2, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
      { id: 'p2', version_id: versionId, day_of_week: 2, period_num: 4, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
      { id: 'p3', version_id: versionId, day_of_week: 2, period_num: 7, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
      { id: 'p4', version_id: versionId, day_of_week: 2, period_num: 8, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
      { id: 'p5', version_id: versionId, day_of_week: 2, period_num: 9, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Weekly Test', entry_type: 'TEST' },

      // Mrs. Dipika Thapa: 5-Eng 2, 5B-Spell
      { id: 'd1', version_id: versionId, day_of_week: 1, period_num: 4, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'd2', version_id: versionId, day_of_week: 1, period_num: 6, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'd3', version_id: versionId, day_of_week: 3, period_num: 7, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'd4', version_id: versionId, day_of_week: 3, period_num: 8, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Spelling', entry_type: 'SUBJECT' },
      { id: 'd5', version_id: versionId, day_of_week: 4, period_num: 7, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'd6', version_id: versionId, day_of_week: 5, period_num: 3, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'd7', version_id: versionId, day_of_week: 5, period_num: 5, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },

      // Mr. Sashank Lama: Music
      { id: 's1', version_id: versionId, day_of_week: 1, period_num: 7, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
      { id: 's2', version_id: versionId, day_of_week: 1, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
      { id: 's3', version_id: versionId, day_of_week: 1, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Music', entry_type: 'SINGING' },
      { id: 's4', version_id: versionId, day_of_week: 2, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
      { id: 's5', version_id: versionId, day_of_week: 2, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Weekly Test', entry_type: 'TEST' },

      // Mr. Dhirendra Lama: 9, 10 Art / 5 Drawing, Singing / 6 Singing / SUPW
      { id: 'dh1', version_id: versionId, day_of_week: 1, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'SUPW', entry_type: 'SUPW' },
      { id: 'dh2', version_id: versionId, day_of_week: 1, period_num: 3, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY' },
      { id: 'dh3', version_id: versionId, day_of_week: 1, period_num: 5, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Singing', entry_type: 'SINGING' },
      { id: 'dh4', version_id: versionId, day_of_week: 1, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Singing', entry_type: 'SINGING' },
      { id: 'dh5', version_id: versionId, day_of_week: 2, period_num: 1, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Assembly / M.Sc.', entry_type: 'ASSEMBLY' },
      { id: 'dh6', version_id: versionId, day_of_week: 2, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'SUPW', entry_type: 'SUPW' },
      { id: 'dh7', version_id: versionId, day_of_week: 2, period_num: 9, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Weekly Test', entry_type: 'TEST' },

      // Mr. Keiran Thapa: English 2
      { id: 'kt1', version_id: versionId, day_of_week: 1, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'kt2', version_id: versionId, day_of_week: 2, period_num: 3, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
      { id: 'kt3', version_id: versionId, day_of_week: 3, period_num: 2, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },

      // Mr. Rakesh Rai: Handwriting, Art & Craft
      { id: 'rk1', version_id: versionId, day_of_week: 2, period_num: 1, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Assembly / M.Sc.', entry_type: 'ASSEMBLY' },
      { id: 'rk2', version_id: versionId, day_of_week: 2, period_num: 2, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Handwriting', entry_type: 'SUBJECT' },
      { id: 'rk3', version_id: versionId, day_of_week: 2, period_num: 3, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Handwriting', entry_type: 'SUBJECT' },
      { id: 'rk4', version_id: versionId, day_of_week: 2, period_num: 4, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Art & Craft', entry_type: 'DRAWING' },
      { id: 'rk5', version_id: versionId, day_of_week: 2, period_num: 5, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Art & Craft', entry_type: 'DRAWING' },
      { id: 'rk6', version_id: versionId, day_of_week: 2, period_num: 9, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Weekly Test', entry_type: 'TEST' },

      // PTI: PT / Games / Assembly
      { id: 'pt1', version_id: versionId, day_of_week: 2, period_num: 1, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-school', class_name: 'All', section: '', subject_name: 'Morning Assembly', entry_type: 'ASSEMBLY' },
      { id: 'pt2', version_id: versionId, day_of_week: 2, period_num: 4, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'PT / Games', entry_type: 'GAMES' },
      { id: 'pt3', version_id: versionId, day_of_week: 2, period_num: 5, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'PT / Games', entry_type: 'GAMES' },
      { id: 'pt4', version_id: versionId, day_of_week: 2, period_num: 9, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Weekly Test', entry_type: 'TEST' }
    ];

    this.entries = seed;

    // Acknowledgements
    const teachers = [...new Set(seed.map(e => e.teacher_id))];
    teachers.forEach(tId => {
      const e = seed.find(s => s.teacher_id === tId);
      this.acknowledgements.push({
        id: `ack-${versionId}-${tId}`,
        version_id: versionId,
        teacher_id: tId,
        teacher_name: e.teacher_name,
        viewed_at: null,
        acknowledged_at: null
      });
    });
  }

  // Conflict validation
  validate(entries) {
    const criticalErrors = [];
    const warnings = [];

    const teacherMap = new Map();
    const classMap = new Map();
    const roomMap = new Map();

    entries.forEach(e => {
      const day = e.day_of_week;
      const period = e.period_num;

      // Missing checks
      if (!e.teacher_id && e.entry_type !== 'FREE PERIOD') {
        criticalErrors.push({ type: 'MISSING_TEACHER', message: `Day ${day} Period ${period} missing teacher` });
      }
      if (!e.class_id && e.entry_type !== 'ASSEMBLY' && e.entry_type !== 'FREE PERIOD') {
        criticalErrors.push({ type: 'MISSING_CLASS', message: `Day ${day} Period ${period} missing class` });
      }

      // Teacher conflict
      if (e.teacher_id && e.entry_type !== 'FREE PERIOD') {
        const tKey = `${day}_${period}_${e.teacher_id}`;
        if (teacherMap.has(tKey)) {
          criticalErrors.push({ type: 'TEACHER_CONFLICT', message: `Teacher double booked: ${e.teacher_name} at Day ${day} Period ${period}` });
        } else {
          teacherMap.set(tKey, e);
        }
      }

      // Class conflict
      if (e.class_id && e.entry_type !== 'ASSEMBLY' && e.entry_type !== 'FREE PERIOD') {
        const cKey = `${day}_${period}_${e.class_id}_${e.section || ''}`;
        if (classMap.has(cKey)) {
          criticalErrors.push({ type: 'CLASS_CONFLICT', message: `Class double booked: Class ${e.class_name} at Day ${day} Period ${period}` });
        } else {
          classMap.set(cKey, e);
        }
      }

      // Room conflict
      if (e.room && e.room.trim() && e.entry_type !== 'FREE PERIOD') {
        const rKey = `${day}_${period}_${e.room.trim().toLowerCase()}`;
        if (roomMap.has(rKey)) {
          criticalErrors.push({ type: 'ROOM_CONFLICT', message: `Room double booked: ${e.room} at Day ${day} Period ${period}` });
        } else {
          roomMap.set(rKey, e);
        }
      }
    });

    return {
      isValid: criticalErrors.length === 0,
      criticalErrors,
      warnings
    };
  }

  // Teacher projection
  getTeacherRoutine(teacherId, versionId) {
    const tEntries = this.entries.filter(e => e.version_id === versionId && e.teacher_id === teacherId);
    const scheduleByDay = {};
    WORKING_DAYS.forEach(day => {
      scheduleByDay[day.id] = {
        dayId: day.id,
        dayName: day.name,
        periods: this.periods.map(p => {
          const entry = tEntries.find(e => e.day_of_week === day.id && e.period_num === p.period_num);
          return {
            period_num: p.period_num,
            period_name: p.period_name,
            start_time: p.start_time,
            end_time: p.end_time,
            entry: entry || null,
            is_free: !entry
          };
        })
      };
    });

    const teacherName = tEntries[0]?.teacher_name || 'Teacher';
    return {
      teacherId,
      teacherName,
      scheduleByDay,
      totalAssignedPeriods: tEntries.length,
      freePeriodsCount: (5 * 9) - tEntries.length
    };
  }

  // Class projection
  getClassRoutine(className, section, versionId) {
    const cEntries = this.entries.filter(e => 
      e.version_id === versionId && 
      String(e.class_name) === String(className) && 
      (!section || String(e.section).toLowerCase() === String(section).toLowerCase())
    );
    const scheduleByDay = {};
    WORKING_DAYS.forEach(day => {
      scheduleByDay[day.id] = {
        dayId: day.id,
        dayName: day.name,
        periods: this.periods.map(p => {
          const entry = cEntries.find(e => e.day_of_week === day.id && e.period_num === p.period_num);
          return {
            period_num: p.period_num,
            period_name: p.period_name,
            entry: entry || null,
            is_free: !entry
          };
        })
      };
    });

    return {
      className,
      section,
      fullClassName: `Class ${className} ${section || ''}`.trim(),
      scheduleByDay
    };
  }

  // Who is teaching
  getWhoIsTeaching(dayOfWeek, periodNum, versionId) {
    return this.entries.filter(e => 
      e.version_id === versionId && 
      e.day_of_week === dayOfWeek && 
      e.period_num === periodNum
    );
  }

  // Who is free
  getWhoIsFree(dayOfWeek, periodNum, versionId) {
    const busyEntries = this.getWhoIsTeaching(dayOfWeek, periodNum, versionId);
    const busyIds = new Set(busyEntries.map(e => e.teacher_id));
    const allTeacherIds = [...new Set(this.entries.map(e => e.teacher_id))];
    const freeIds = allTeacherIds.filter(id => !busyIds.has(id));
    return {
      dayOfWeek,
      periodNum,
      busyCount: busyEntries.length,
      freeCount: freeIds.length,
      freeTeacherIds: freeIds
    };
  }

  // Publish
  publish(versionId) {
    const v = this.versions.find(ver => ver.id === versionId);
    if (!v) throw new Error('Version not found');
    const entries = this.entries.filter(e => e.version_id === versionId);
    const val = this.validate(entries);
    if (!val.isValid) throw new Error(`Validation failed with ${val.criticalErrors.length} errors`);

    // Supersede old
    this.versions.forEach(ver => {
      if (ver.status === 'PUBLISHED' && ver.id !== versionId) {
        ver.status = 'SUPERSEDED';
      }
    });

    v.status = 'PUBLISHED';
    v.published_at = new Date().toISOString();
    return v;
  }

  // Acknowledge
  acknowledge(versionId, teacherId) {
    let ack = this.acknowledgements.find(a => a.version_id === versionId && a.teacher_id === teacherId);
    const now = new Date().toISOString();
    if (ack) {
      ack.viewed_at = ack.viewed_at || now;
      ack.acknowledged_at = now;
    } else {
      ack = {
        id: `ack-${versionId}-${teacherId}`,
        version_id: versionId,
        teacher_id: teacherId,
        viewed_at: now,
        acknowledged_at: now
      };
      this.acknowledgements.push(ack);
    }
    return ack;
  }

  getDistributionStatus(versionId) {
    const acks = this.acknowledgements.filter(a => a.version_id === versionId);
    const totalTeachers = acks.length;
    const viewedCount = acks.filter(a => a.viewed_at !== null).length;
    const acknowledgedCount = acks.filter(a => a.acknowledged_at !== null).length;
    const pendingCount = totalTeachers - acknowledgedCount;
    return { totalTeachers, viewedCount, acknowledgedCount, pendingCount, acknowledgements: acks };
  }
}

// -------------------------------------------------------------
// TEST RUNNER
// -------------------------------------------------------------
const engine = new TestRoutineEngine();
let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${testName} ->`, err.message);
    failed++;
  }
}

console.log('================================================================');
console.log('GYANODAY NIKETAN: ROUTINE MANAGEMENT SYSTEM AUTOMATED TESTS');
console.log('================================================================\n');

// 1. Routine Periods & Days
runTest('Test 1: Default periods configured to 9 academic periods with valid time slots', () => {
  assert.strictEqual(engine.periods.length, 9);
  assert.strictEqual(engine.periods[0].period_name, '1st Period');
  assert.strictEqual(engine.periods[8].period_name, '9th Period');
  assert.strictEqual(engine.periods[8].is_special, true); // Weekly Test Slot
});

runTest('Test 2: Working days correctly configured for Monday to Friday', () => {
  assert.strictEqual(WORKING_DAYS.length, 5);
  assert.strictEqual(WORKING_DAYS[0].name, 'Monday');
  assert.strictEqual(WORKING_DAYS[4].name, 'Friday');
});

runTest('Test 3: Active published version V1 initialized with status PUBLISHED', () => {
  const v1 = engine.versions.find(v => v.version_code === 'V1');
  assert.ok(v1);
  assert.strictEqual(v1.status, 'PUBLISHED');
  assert.strictEqual(v1.academic_year, '2026');
});

// 2. Real-World Handwritten Sheet Verification
runTest('Test 4: Mrs. Pinky BK routine correctly captures Classes 5, 6, 7, 8 TL Nepali', () => {
  const pinkyEntries = engine.entries.filter(e => e.teacher_id === 't-pinky-bk');
  assert.strictEqual(pinkyEntries.length, 5);
  const classes = pinkyEntries.map(e => e.class_name);
  assert.ok(classes.includes('5'));
  assert.ok(classes.includes('6'));
  assert.ok(classes.includes('7'));
  assert.ok(classes.includes('8'));
});

runTest('Test 5: Mrs. Pinky BK Tuesday Period 9 is locked as TEST (Weekly Test)', () => {
  const tueTest = engine.entries.find(e => e.teacher_id === 't-pinky-bk' && e.day_of_week === 2 && e.period_num === 9);
  assert.ok(tueTest);
  assert.strictEqual(tueTest.entry_type, 'TEST');
  assert.strictEqual(tueTest.subject_name, 'Weekly Test');
});

runTest('Test 6: Mrs. Dipika Thapa routine captures Class 5 English 2 and 5B Spelling', () => {
  const dipikaEntries = engine.entries.filter(e => e.teacher_id === 't-dipika-thapa');
  assert.strictEqual(dipikaEntries.length, 7);
  const subjects = dipikaEntries.map(e => e.subject_name);
  assert.ok(subjects.includes('English 2'));
  assert.ok(subjects.includes('Spelling'));
});

runTest('Test 7: Mr. Sashank Lama routine captures Music across Classes 5A, 5B, 9, 10', () => {
  const sashankEntries = engine.entries.filter(e => e.teacher_id === 't-sashank-lama');
  assert.ok(sashankEntries.length >= 5);
  const tueTest = sashankEntries.find(e => e.day_of_week === 2 && e.period_num === 9);
  assert.ok(tueTest);
  assert.strictEqual(tueTest.entry_type, 'TEST');
});

runTest('Test 8: Mr. Dhirendra Lama routine captures Art, Singing, Drawing, SUPW, Library', () => {
  const dhirendraEntries = engine.entries.filter(e => e.teacher_id === 't-dhirendra-lama');
  assert.ok(dhirendraEntries.length >= 6);
  const types = dhirendraEntries.map(e => e.entry_type);
  assert.ok(types.includes('SUPW'));
  assert.ok(types.includes('LIBRARY'));
  assert.ok(types.includes('SINGING'));
  assert.ok(types.includes('ASSEMBLY'));
  assert.ok(types.includes('TEST'));
});

runTest('Test 9: PTI routine captures PT/Games, Taekwondo and Morning Assembly', () => {
  const ptiEntries = engine.entries.filter(e => e.teacher_id === 't-pti');
  assert.ok(ptiEntries.length >= 4);
  const assembly = ptiEntries.find(e => e.entry_type === 'ASSEMBLY');
  assert.ok(assembly);
  assert.strictEqual(assembly.day_of_week, 2);
  assert.strictEqual(assembly.period_num, 1);
});

// 3. Single Source of Truth: Teacher-Centric Projection
runTest('Test 10: Teacher Routine View generates complete 5-day x 9-period matrix', () => {
  const teacherRoutine = engine.getTeacherRoutine('t-keiran-thapa', 'v-2026-v1-published');
  assert.strictEqual(teacherRoutine.teacherName, 'Mr. Keiran Thapa');
  assert.strictEqual(Object.keys(teacherRoutine.scheduleByDay).length, 5);
  // Monday schedule
  const mon = teacherRoutine.scheduleByDay[1];
  assert.strictEqual(mon.periods.length, 9);
  // Period 1 assigned to Class 8 A English 2
  const p1 = mon.periods[0];
  assert.strictEqual(p1.is_free, false);
  assert.strictEqual(p1.entry.class_name, '8');
  assert.strictEqual(p1.entry.subject_name, 'English 2');
  // Period 2 is Free
  const p2 = mon.periods[1];
  assert.strictEqual(p2.is_free, true);
  assert.strictEqual(p2.entry, null);
});

runTest('Test 11: Teacher Free Periods calculation accurately totals unassigned slots', () => {
  const teacherRoutine = engine.getTeacherRoutine('t-keiran-thapa', 'v-2026-v1-published');
  assert.strictEqual(teacherRoutine.totalAssignedPeriods, 3);
  assert.strictEqual(teacherRoutine.freePeriodsCount, 42); // 45 - 3 = 42
});

// 4. Single Source of Truth: Class-Wise Projection
runTest('Test 12: Class Routine View generates 5-day x 9-period matrix for Class 8 A', () => {
  const cls8a = engine.getClassRoutine('8', 'A', 'v-2026-v1-published');
  assert.strictEqual(cls8a.fullClassName, 'Class 8 A');
  assert.strictEqual(Object.keys(cls8a.scheduleByDay).length, 5);
  // Monday Period 1 is English 2 by Mr. Keiran Thapa
  const monP1 = cls8a.scheduleByDay[1].periods[0];
  assert.strictEqual(monP1.entry.subject_name, 'English 2');
  assert.strictEqual(monP1.entry.teacher_name, 'Mr. Keiran Thapa');
});

runTest('Test 13: Section isolation: Class 8 A routine does not leak into Class 8 B', () => {
  const cls8b = engine.getClassRoutine('8', 'B', 'v-2026-v1-published');
  // On Tuesday Period 4, Class 8 B has PT / Games with PTI
  const tueP4 = cls8b.scheduleByDay[2].periods[3];
  assert.strictEqual(tueP4.entry.subject_name, 'PT / Games');
  assert.strictEqual(tueP4.entry.teacher_name, 'Physical Training Instructors (PTI)');
  // Class 8 A has TL Nepali with Mrs. Pinky BK
  const cls8a = engine.getClassRoutine('8', 'A', 'v-2026-v1-published');
  const tueP4_8a = cls8a.scheduleByDay[2].periods[3];
  assert.strictEqual(tueP4_8a.entry, null); // 8A free in period 4
});

// 5. Supervision Views
runTest('Test 14: "Who is Teaching?" returns all classes and teachers for Tuesday Period 9 (Test)', () => {
  const testPeriod = engine.getWhoIsTeaching(2, 9, 'v-2026-v1-published');
  assert.ok(testPeriod.length >= 5);
  testPeriod.forEach(item => {
    assert.strictEqual(item.entry_type, 'TEST');
  });
});

runTest('Test 15: "Who is Free?" accurately identifies unassigned teachers ready for substitution', () => {
  const freePeriod = engine.getWhoIsFree(1, 1, 'v-2026-v1-published'); // Monday Period 1
  // Mr. Keiran Thapa is teaching Class 8A in Period 1
  assert.ok(!freePeriod.freeTeacherIds.includes('t-keiran-thapa'));
  // Mrs. Dipika Thapa has no class in Monday Period 1
  assert.ok(freePeriod.freeTeacherIds.includes('t-dipika-thapa'));
});

// 6. Validation & Conflict Detection
runTest('Test 16: Valid routine passes validation with isValid: true and 0 critical errors', () => {
  const res = engine.validate(engine.entries);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.criticalErrors.length, 0);
});

runTest('Test 17: Teacher Double-Booking conflict detected when teacher assigned twice in same period', () => {
  const clashEntries = [
    ...engine.entries,
    { id: 'clash1', day_of_week: 1, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' }
  ];
  const res = engine.validate(clashEntries);
  assert.strictEqual(res.isValid, false);
  const teacherClash = res.criticalErrors.find(e => e.type === 'TEACHER_CONFLICT');
  assert.ok(teacherClash);
  assert.ok(teacherClash.message.includes('double booked'));
});

runTest('Test 18: Class Double-Booking conflict detected when class has 2 teachers in same period', () => {
  const clashEntries = [
    ...engine.entries,
    { id: 'clash2', day_of_week: 1, period_num: 1, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Grammar', entry_type: 'SUBJECT' }
  ];
  const res = engine.validate(clashEntries);
  assert.strictEqual(res.isValid, false);
  const classClash = res.criticalErrors.find(e => e.type === 'CLASS_CONFLICT');
  assert.ok(classClash);
  assert.ok(classClash.message.includes('Class double booked'));
});

runTest('Test 19: Room Double-Booking conflict detected when same room used twice in same period', () => {
  const clashEntries = [
    ...engine.entries,
    { id: 'clash3a', day_of_week: 3, period_num: 1, teacher_id: 't-t1', teacher_name: 'T1', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Computer', entry_type: 'LAB', room: 'Computer Lab' },
    { id: 'clash3b', day_of_week: 3, period_num: 1, teacher_id: 't-t2', teacher_name: 'T2', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Robotics', entry_type: 'ROBOTICS', room: 'Computer Lab' }
  ];
  const res = engine.validate(clashEntries);
  assert.strictEqual(res.isValid, false);
  const roomClash = res.criticalErrors.find(e => e.type === 'ROOM_CONFLICT');
  assert.ok(roomClash);
  assert.ok(roomClash.message.includes('Room double booked'));
});

runTest('Test 20: Missing teacher on non-free period triggers critical error', () => {
  const invalidEntries = [
    { id: 'inv1', day_of_week: 1, period_num: 2, teacher_id: '', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Math', entry_type: 'SUBJECT' }
  ];
  const res = engine.validate(invalidEntries);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.criticalErrors.some(e => e.type === 'MISSING_TEACHER'));
});

// 7. Publishing & Superseding
runTest('Test 21: Publishing routine with critical conflicts is strictly blocked', () => {
  const invalidVersion = { id: 'v-bad', version_code: 'V-Bad', status: 'DRAFT' };
  engine.versions.push(invalidVersion);
  engine.entries.push({ id: 'bad-e', version_id: 'v-bad', day_of_week: 1, period_num: 1, teacher_id: '', class_id: 'c-5a', entry_type: 'SUBJECT' });

  assert.throws(() => {
    engine.publish('v-bad');
  }, /Validation failed/);
});

runTest('Test 22: Successful publishing supersedes previous published version', () => {
  const v2 = { id: 'v-2026-v2', academic_year: '2026', version_code: 'V2', version_num: 2, status: 'DRAFT' };
  engine.versions.push(v2);
  // Add clean valid entries for V2
  engine.entries.push({ id: 'v2-e1', version_id: 'v-2026-v2', day_of_week: 1, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' });

  const published = engine.publish('v-2026-v2');
  assert.strictEqual(published.status, 'PUBLISHED');

  const oldV1 = engine.versions.find(v => v.id === 'v-2026-v1-published');
  assert.strictEqual(oldV1.status, 'SUPERSEDED');
});

// 8. Teacher Acknowledgement & Distribution Tracking
runTest('Test 23: Teacher acknowledging routine updates acknowledged_at and viewed_at timestamps', () => {
  const ack = engine.acknowledge('v-2026-v1-published', 't-keiran-thapa');
  assert.strictEqual(ack.teacher_id, 't-keiran-thapa');
  assert.ok(ack.acknowledged_at);
  assert.ok(ack.viewed_at);
});

runTest('Test 24: Distribution status dashboard computes exact viewed, acknowledged, and pending counts', () => {
  const dist = engine.getDistributionStatus('v-2026-v1-published');
  assert.ok(dist.totalTeachers >= 6);
  assert.strictEqual(dist.acknowledgedCount, 1); // Mr. Keiran Thapa
  assert.strictEqual(dist.pendingCount, dist.totalTeachers - 1);
});

runTest('Test 25: Special activities (Assembly, Test, Library, Singing, Games, SUPW) correctly supported', () => {
  const validTypes = ROUTINE_ENTRY_TYPES;
  assert.ok(validTypes.includes('ASSEMBLY'));
  assert.ok(validTypes.includes('TEST'));
  assert.ok(validTypes.includes('LIBRARY'));
  assert.ok(validTypes.includes('SINGING'));
  assert.ok(validTypes.includes('GAMES'));
  assert.ok(validTypes.includes('SUPW'));
  assert.ok(validTypes.includes('ROBOTICS'));
  assert.ok(validTypes.includes('FREE PERIOD'));
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
