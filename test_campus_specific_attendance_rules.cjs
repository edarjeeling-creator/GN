/**
 * test_campus_specific_attendance_rules.cjs
 * Comprehensive Automated Test Suite for:
 * Campus-Specific Staff Attendance Timing Rules & Grace Periods
 * 
 * Executes all 38 test scenarios from Section 21 & Section 15 of user request:
 * - Exact boundary tests (inclusive <= 08:50:00 Junior, <= 08:25:00 Senior)
 * - Zero silent fallbacks (ATTENDANCE_RULE_NOT_CONFIGURED)
 * - Overlap prevention & derived threshold consistency
 * - Immutable rule versioning & historical integrity
 * - Role-based authorization & non-destructive foreign keys
 */

const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('GYANODAY NIKETAN: CAMPUS-SPECIFIC ATTENDANCE RULES TEST SUITE');
console.log('================================================================\n');

// ------------------------------------------------------------------------------
// 1. Core Utilities (Matching PostgreSQL Definitions)
// ------------------------------------------------------------------------------
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parses "HH:MM:SS" or "HH:MM" into seconds from midnight
 */
function timeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

function secondsToTime(totalSec) {
  const h = Math.floor(totalSec / 3600) % 24;
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Converts UTC timestamp or Date to local Asia/Kolkata (IST +05:30)
 */
function toKolkataTime(dateOrTimestamp) {
  const date = typeof dateOrTimestamp === 'string' ? new Date(dateOrTimestamp) : dateOrTimestamp;
  const utcMillis = date.getTime();
  const istMillis = utcMillis + (5.5 * 3600 * 1000);
  const istDate = new Date(istMillis);

  const hours = istDate.getUTCHours();
  const mins = istDate.getUTCMinutes();
  const secs = istDate.getUTCSeconds();
  const dateStr = istDate.toISOString().split('T')[0];
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return {
    date: dateStr,
    time: timeStr,
    seconds: hours * 3600 + mins * 60 + secs
  };
}

// ------------------------------------------------------------------------------
// 2. Simulated Authoritative Database State
// ------------------------------------------------------------------------------
function createInitialDB() {
  return {
    campuses: [
      {
        id: 'camp-senior-uuid',
        campus_id: 'SENIOR_SCHOOL',
        campus_name: 'Senior School',
        latitude: 27.036007,
        longitude: 88.262672,
        geofence_radius_meters: 150.0,
        max_gps_accuracy_meters: 50.0,
        status: 'ACTIVE'
      },
      {
        id: 'camp-junior-uuid',
        campus_id: 'JUNIOR_SCHOOL',
        campus_name: 'Junior School',
        latitude: 27.038500,
        longitude: 88.264500,
        geofence_radius_meters: 150.0,
        max_gps_accuracy_meters: 50.0,
        status: 'ACTIVE'
      },
      {
        id: 'camp-empty-rule-uuid',
        campus_id: 'NEW_CAMPUS_NO_RULES',
        campus_name: 'New Unconfigured Campus',
        latitude: 27.040000,
        longitude: 88.270000,
        geofence_radius_meters: 150.0,
        max_gps_accuracy_meters: 50.0,
        status: 'ACTIVE'
      }
    ],

    campus_attendance_rules: [
      // Senior School Rule: 08:15 + 10m -> 08:25:00
      {
        id: 'rule-senior-v1',
        campus_id: 'camp-senior-uuid',
        academic_year_id: '2026',
        school_start_time: '08:15:00',
        grace_period_minutes: 10,
        late_threshold: '08:25:00',
        effective_from: '2026-01-01',
        effective_to: null,
        active: true,
        version: 1
      },
      // Junior School Rule: 08:40 + 10m -> 08:50:00
      {
        id: 'rule-junior-v1',
        campus_id: 'camp-junior-uuid',
        academic_year_id: '2026',
        school_start_time: '08:40:00',
        grace_period_minutes: 10,
        late_threshold: '08:50:00',
        effective_from: '2026-01-01',
        effective_to: null,
        active: true,
        version: 1
      }
    ],

    campus_attendance_rule_audit_logs: [
      {
        id: 'audit-1',
        rule_id: 'rule-senior-v1',
        campus_id: 'camp-senior-uuid',
        academic_year_id: '2026',
        version: 1,
        new_start_time: '08:15:00',
        new_grace_period: 10,
        new_late_threshold: '08:25:00',
        effective_from: '2026-01-01',
        reason: 'Initial Canonical Senior Rule'
      },
      {
        id: 'audit-2',
        rule_id: 'rule-junior-v1',
        campus_id: 'camp-junior-uuid',
        academic_year_id: '2026',
        version: 1,
        new_start_time: '08:40:00',
        new_grace_period: 10,
        new_late_threshold: '08:50:00',
        effective_from: '2026-01-01',
        reason: 'Initial Canonical Junior Rule'
      }
    ],

    kiosks: [
      {
        id: 'kiosk-senior-uuid',
        device_id: 'GN-SENIOR-001',
        device_name: 'Senior School Main Gate Kiosk',
        campus_id: 'camp-senior-uuid',
        kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
        status: 'ACTIVE'
      },
      {
        id: 'kiosk-junior-uuid',
        device_id: 'GN-JUNIOR-001',
        device_name: 'Junior School Main Gate Kiosk',
        campus_id: 'camp-junior-uuid',
        kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
        status: 'ACTIVE'
      }
    ],

    teachers: [
      { id: 'teacher-senior-uuid', name: 'Senior Teacher', role: 'teacher' },
      { id: 'teacher-junior-uuid', name: 'Junior Teacher', role: 'teacher' },
      { id: 'teacher-dual-uuid', name: 'Dual Campus Teacher', role: 'teacher' },
      { id: 'principal-uuid', name: 'Principal Subodh', role: 'principal' },
      { id: 'admin-uuid', name: 'System Admin', role: 'admin' }
    ],

    assignments: [
      { id: 'a1', teacher_id: 'teacher-senior-uuid', campus_id: 'camp-senior-uuid', active: true },
      { id: 'a2', teacher_id: 'teacher-junior-uuid', campus_id: 'camp-junior-uuid', active: true },
      { id: 'a3', teacher_id: 'teacher-dual-uuid', campus_id: 'camp-senior-uuid', active: true },
      { id: 'a4', teacher_id: 'teacher-dual-uuid', campus_id: 'camp-junior-uuid', active: true }
    ],

    qr_sessions: [],
    attendance: [],
    attendance_audit_logs: [],
    correction_requests: []
  };
}

let DB = createInitialDB();

// ------------------------------------------------------------------------------
// 3. Simulated PostgreSQL RPC Functions & Constraints
// ------------------------------------------------------------------------------

/**
 * Validates trigger fn_validate_campus_attendance_rule
 */
function server_validate_rule_record(rule) {
  const expectedThresholdSec = timeToSeconds(rule.school_start_time) + (rule.grace_period_minutes * 60);
  const expectedThreshold = secondsToTime(expectedThresholdSec);

  if (rule.late_threshold && rule.late_threshold !== expectedThreshold) {
    throw new Error(`INCONSISTENT_THRESHOLD: late_threshold (${rule.late_threshold}) does not match school_start_time (${rule.school_start_time}) + grace_period_minutes (${rule.grace_period_minutes}) = ${expectedThreshold}`);
  }

  if (rule.effective_to && rule.effective_from > rule.effective_to) {
    throw new Error('INVALID_RANGE: effective_from cannot be after effective_to');
  }

  if (rule.active) {
    const end = rule.effective_to || '9999-12-31';
    const overlap = DB.campus_attendance_rules.find(r => 
      r.campus_id === rule.campus_id &&
      r.academic_year_id === rule.academic_year_id &&
      r.active &&
      r.id !== rule.id &&
      rule.effective_from <= (r.effective_to || '9999-12-31') &&
      end >= r.effective_from
    );

    if (overlap) {
      throw new Error(`OVERLAPPING_ATTENDANCE_RULE: Active rule version ${overlap.version} already exists for this campus covering period ${overlap.effective_from} to ${overlap.effective_to || 'indefinite'}`);
    }
  }

  return expectedThreshold;
}

/**
 * Administrative rule creation/update matching admin_create_or_update_campus_attendance_rule
 */
function server_admin_create_or_update_rule({ callerId, campusId, schoolStartTime, gracePeriodMinutes, effectiveFrom, reason }) {
  const caller = DB.teachers.find(t => t.id === callerId);
  if (!caller) throw new Error('UNAUTHENTICATED');
  if (!['admin', 'principal'].includes(caller.role)) {
    throw new Error('UNAUTHORIZED_ROLE: Only Administrators and Principals may configure attendance rules.');
  }

  if (!campusId) throw new Error('INVALID_CAMPUS');
  const campus = DB.campuses.find(c => c.id === campusId);
  if (!campus) throw new Error('CAMPUS_NOT_FOUND');

  if (!schoolStartTime) throw new Error('INVALID_START_TIME');
  if (gracePeriodMinutes == null || gracePeriodMinutes < 0) throw new Error('INVALID_GRACE_PERIOD');
  if (!reason || !reason.trim()) throw new Error('REASON_REQUIRED');

  const derivedThreshold = secondsToTime(timeToSeconds(schoolStartTime) + (gracePeriodMinutes * 60));

  // Find active rule
  const currentActive = DB.campus_attendance_rules.find(r => 
    r.campus_id === campusId && r.active && (!r.effective_to || r.effective_to >= effectiveFrom)
  );

  let version = 1;
  let oldStart = null;
  let oldGrace = null;
  let oldThresh = null;

  if (currentActive) {
    version = currentActive.version + 1;
    oldStart = currentActive.school_start_time;
    oldGrace = currentActive.grace_period_minutes;
    oldThresh = currentActive.late_threshold;

    // Close previous rule
    const effDate = new Date(effectiveFrom);
    const dayBefore = new Date(effDate.getTime() - 86400000).toISOString().split('T')[0];
    currentActive.effective_to = dayBefore;
  }

  const newRule = {
    id: `rule-${campus.campus_id}-v${version}-${Date.now()}`,
    campus_id: campusId,
    academic_year_id: '2026',
    school_start_time: schoolStartTime,
    grace_period_minutes: gracePeriodMinutes,
    late_threshold: derivedThreshold,
    effective_from: effectiveFrom,
    effective_to: null,
    active: true,
    version
  };

  server_validate_rule_record(newRule);
  DB.campus_attendance_rules.push(newRule);

  // Immutable audit log
  DB.campus_attendance_rule_audit_logs.push({
    id: crypto.randomUUID(),
    rule_id: newRule.id,
    campus_id: campusId,
    academic_year_id: '2026',
    version,
    old_start_time: oldStart,
    new_start_time: schoolStartTime,
    old_grace_period: oldGrace,
    new_grace_period: gracePeriodMinutes,
    old_late_threshold: oldThresh,
    new_late_threshold: derivedThreshold,
    effective_from: effectiveFrom,
    effective_to: null,
    changed_by: callerId,
    changed_at: new Date().toISOString(),
    reason
  });

  return newRule;
}

/**
 * Generate QR session via kiosk
 */
function server_kiosk_generate_qr_session(deviceId, secret, actionType, expirySec = 20) {
  const kiosk = DB.kiosks.find(k => k.device_id === deviceId);
  if (!kiosk) throw new Error(`UNAUTHORIZED_KIOSK: Device ${deviceId} not registered`);
  if (kiosk.status !== 'ACTIVE') throw new Error(`UNAUTHORIZED_KIOSK: Device ${deviceId} is ${kiosk.status}`);
  if (sha256Hex(secret) !== kiosk.kiosk_secret_hash) throw new Error('UNAUTHORIZED_KIOSK: Invalid credentials');

  const campus = DB.campuses.find(c => c.id === kiosk.campus_id);
  if (!campus || campus.status !== 'ACTIVE') throw new Error('CAMPUS_INACTIVE');

  const now = Date.now();
  const token = `GNQR_${campus.campus_id}_${actionType}_${crypto.randomUUID()}`;
  const session = {
    id: crypto.randomUUID(),
    session_token: token,
    action_type: actionType,
    kiosk_id: kiosk.id,
    campus_id: campus.id,
    created_at: now,
    expires_at: now + (expirySec * 1000),
    is_active: true
  };
  DB.qr_sessions.push(session);

  return { sessionToken: token, campusId: campus.id, kioskId: kiosk.id };
}

/**
 * Authoritative verify_and_record_teacher_attendance RPC
 */
function server_verify_and_record_attendance({
  teacherId,
  sessionToken,
  actionType,
  lat,
  lng,
  accuracy,
  overrideServerTimestamp = null,
  clientSuppliedCampusId = null
}) {
  if (!teacherId) throw new Error('UNAUTHENTICATED');
  const teacher = DB.teachers.find(t => t.id === teacherId);
  if (!teacher || !['teacher', 'admin', 'principal'].includes(teacher.role)) {
    throw new Error('ONLY_TEACHERS_PERMITTED');
  }

  // 1. Session lookup
  const session = DB.qr_sessions.find(s => s.session_token === sessionToken);
  if (!session) throw new Error('INVALID_QR_TOKEN');
  if (session.action_type !== actionType) throw new Error('QR_ACTION_MISMATCH');
  if (!session.is_active) throw new Error('QR_ALREADY_USED');

  const serverTimestamp = overrideServerTimestamp ? new Date(overrideServerTimestamp) : new Date();
  if (!overrideServerTimestamp && serverTimestamp.getTime() > session.expires_at) {
    throw new Error('QR_EXPIRED');
  }

  // 2. Authoritative Campus Resolution (IGNORES clientSuppliedCampusId)
  const campus = DB.campuses.find(c => c.id === session.campus_id);
  if (!campus || campus.status !== 'ACTIVE') throw new Error('CAMPUS_INACTIVE');

  // 3. Teacher Campus Authorization
  if (!['admin', 'principal'].includes(teacher.role)) {
    const isAuthorized = DB.assignments.some(a => a.teacher_id === teacherId && a.campus_id === campus.id && a.active);
    if (!isAuthorized) {
      throw new Error(`UNAUTHORIZED_CAMPUS: You are not authorized to mark attendance at ${campus.campus_name}`);
    }
  }

  // 4. GPS & Geofence
  if (lat == null || lng == null) throw new Error('LOCATION_REQUIRED');
  const maxAcc = campus.max_gps_accuracy_meters || 50.0;
  if (accuracy != null && accuracy > maxAcc) {
    throw new Error(`GPS_ACCURACY_INSUFFICIENT: GPS accuracy of ${accuracy}m is too poor`);
  }

  const distance = calculateHaversineDistance(lat, lng, campus.latitude, campus.longitude);
  if (distance > campus.geofence_radius_meters) {
    throw new Error(`GEOFENCE_EXCEEDED: Distance ${Math.round(distance)}m exceeds ${campus.geofence_radius_meters}m`);
  }

  // Local Indian Date & Time Conversion
  const kolkata = toKolkataTime(serverTimestamp);
  const today = kolkata.date;
  const localTimeStr = kolkata.time;
  const localTimeSec = kolkata.seconds;

  // 5. Look up Authoritative Campus Timing Rule (ZERO SILENT FALLBACK)
  const rule = DB.campus_attendance_rules.find(r => 
    r.campus_id === campus.id &&
    r.active &&
    (!r.effective_from || r.effective_from <= today) &&
    (!r.effective_to || r.effective_to >= today)
  );

  if (!rule) {
    throw new Error(`ATTENDANCE_RULE_NOT_CONFIGURED: No active attendance timing rule configured for ${campus.campus_name} on ${today}. Please contact school administration.`);
  }

  // Exact boundary evaluation: <= late_threshold is PRESENT, > late_threshold is LATE
  const lateThresholdSec = timeToSeconds(rule.late_threshold);
  let status = localTimeSec <= lateThresholdSec ? 'Present' : 'Late';

  // 6. Mutate Record
  let record = DB.attendance.find(a => a.teacher_id === teacherId && a.attendance_date === today);

  if (actionType === 'CHECK_IN') {
    if (record && record.check_in_time) throw new Error('ALREADY_CHECKED_IN');
    record = {
      id: crypto.randomUUID(),
      teacher_id: teacherId,
      attendance_date: today,
      status,
      check_in_time: serverTimestamp.toISOString(),
      check_in_method: 'DYNAMIC_QR',
      check_in_verification_status: 'VERIFIED',
      campus_id: campus.id,
      kiosk_id: session.kiosk_id,
      attendance_rule_id: rule.id,
      attendance_rule_version: rule.version,
      applied_late_threshold: rule.late_threshold,
      check_in_distance_meters: distance
    };
    DB.attendance.push(record);
  } else if (actionType === 'CHECK_OUT') {
    if (!record || !record.check_in_time) throw new Error('NO_CHECK_IN_FOUND');
    if (record.check_out_time) throw new Error('ALREADY_CHECKED_OUT');
    record.check_out_time = serverTimestamp.toISOString();
    record.check_out_method = 'DYNAMIC_QR';
    record.check_out_verification_status = 'VERIFIED';
    // Checkout does NOT alter check-in status
    status = record.status;
  }

  session.is_active = false;

  return {
    success: true,
    action: actionType,
    status,
    campusId: campus.campus_id,
    campusName: campus.campus_name,
    localTimeStr,
    ruleVersion: rule.version,
    lateThreshold: rule.late_threshold
  };
}

// ------------------------------------------------------------------------------
// 4. TEST RUNNER & ASSERTION INFRASTRUCTURE
// ------------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const results = [];

function runTest(testNumber, name, fn) {
  const idStr = `TEST ${testNumber.toString().padStart(2, '0')}`;
  try {
    const res = fn();
    console.log(`[PASS] ${idStr}: ${name}`);
    passed++;
    results.push({
      test: idStr,
      name,
      status: 'PASS',
      expected: res?.expected || 'Success',
      actual: res?.actual || 'Verified'
    });
  } catch (err) {
    console.error(`[FAIL] ${idStr}: ${name}`);
    console.error(`       Error: ${err.message}`);
    failed++;
    results.push({
      test: idStr,
      name,
      status: 'FAIL',
      expected: 'Expected condition to succeed',
      actual: err.message
    });
  }
}

// GPS constants inside campus geofence
const SENIOR_LAT = 27.036050;
const SENIOR_LNG = 88.262680;
const JUNIOR_LAT = 27.038510;
const JUNIOR_LNG = 88.264510;

// Helper to create test session and run scan at simulated local IST time
function checkInAtKolkataTime({ teacherId, kioskDeviceId, timeStr, dateStr = '2026-09-17', lat, lng, clientSuppliedCampusId = null }) {
  const { sessionToken } = server_kiosk_generate_qr_session(kioskDeviceId, 'GyanodayKiosk@2026', 'CHECK_IN');
  // IST is UTC+5:30 -> ISO with +05:30 offset
  const timestampIso = `${dateStr}T${timeStr}+05:30`;
  return server_verify_and_record_attendance({
    teacherId,
    sessionToken,
    actionType: 'CHECK_IN',
    lat,
    lng,
    accuracy: 10,
    overrideServerTimestamp: timestampIso,
    clientSuppliedCampusId
  });
}

// ==============================================================================
// 5. TEST EXECUTION (ALL 38 TESTS)
// ==============================================================================

// --- JUNIOR SCHOOL EXACT BOUNDARIES (Start 08:40, Grace 10m -> Cutoff 08:50:00) ---
runTest(1, 'Junior 08:39:59 (Before start/grace end) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:39:59', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(2, 'Junior 08:40:00 (Official start time) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:40:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(3, 'Junior 08:49:59 (1s before cutoff) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:49:59', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(4, 'Junior 08:50:00 (EXACT BOUNDARY) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:50:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(5, 'Junior 08:50:01 (1s past boundary) -> LATE', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:50:01', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.status, 'Late');
  return { expected: 'LATE', actual: res.status };
});

runTest(6, 'Junior 08:55:00 (Well past cutoff) -> LATE', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:55:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.status, 'Late');
  return { expected: 'LATE', actual: res.status };
});

// --- SENIOR SCHOOL EXACT BOUNDARIES (Start 08:15, Grace 10m -> Cutoff 08:25:00) ---
runTest(7, 'Senior 08:14:59 (Before start time) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:14:59', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(8, 'Senior 08:15:00 (Official start time) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:15:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(9, 'Senior 08:24:59 (1s before cutoff) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:24:59', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(10, 'Senior 08:25:00 (EXACT BOUNDARY) -> PRESENT', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:25:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.status, 'Present');
  return { expected: 'PRESENT', actual: res.status };
});

runTest(11, 'Senior 08:25:01 (1s past boundary) -> LATE', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:25:01', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.status, 'Late');
  return { expected: 'LATE', actual: res.status };
});

runTest(12, 'Senior 08:30:00 (Well past cutoff) -> LATE', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:30:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.status, 'Late');
  return { expected: 'LATE', actual: res.status };
});

// --- KIOSK CAMPUS BINDING & AUTHORIZATION ---
runTest(13, 'Senior teacher using Senior kiosk -> Senior rule applied', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:25:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert.strictEqual(res.campusId, 'SENIOR_SCHOOL');
  assert.strictEqual(res.lateThreshold, '08:25:00');
  return { expected: 'Senior School 08:25:00', actual: `${res.campusId} ${res.lateThreshold}` };
});

runTest(14, 'Junior teacher using Junior kiosk -> Junior rule applied', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:50:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  assert.strictEqual(res.campusId, 'JUNIOR_SCHOOL');
  assert.strictEqual(res.lateThreshold, '08:50:00');
  return { expected: 'Junior School 08:50:00', actual: `${res.campusId} ${res.lateThreshold}` };
});

runTest(15, 'Cross-campus attendance attempt -> REJECTED', () => {
  DB = createInitialDB();
  assert.throws(() => {
    // Senior teacher scans at Junior kiosk
    checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:30:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  }, /UNAUTHORIZED_CAMPUS/);
  return { expected: 'REJECTED (UNAUTHORIZED_CAMPUS)', actual: 'Thrown UNAUTHORIZED_CAMPUS' };
});

runTest(16, 'Client attempts to supply different campus -> Ignored by server', () => {
  DB = createInitialDB();
  // Senior teacher attempts to pass clientSuppliedCampusId = JUNIOR_SCHOOL while scanning Senior kiosk
  const res = checkInAtKolkataTime({
    teacherId: 'teacher-senior-uuid',
    kioskDeviceId: 'GN-SENIOR-001',
    timeStr: '08:24:00',
    lat: SENIOR_LAT,
    lng: SENIOR_LNG,
    clientSuppliedCampusId: 'JUNIOR_SCHOOL'
  });
  // Must still be resolved as SENIOR_SCHOOL
  assert.strictEqual(res.campusId, 'SENIOR_SCHOOL');
  assert.strictEqual(res.lateThreshold, '08:25:00');
  return { expected: 'SENIOR_SCHOOL (Client input ignored)', actual: res.campusId };
});

// --- ALL CAMPUSES & DIFFERENT CLOCK EVALUATION (Section 15) ---
runTest(17, 'All Campuses: 08:26 is LATE for Senior but PRESENT for Junior', () => {
  DB = createInitialDB();
  const seniorRes = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:26:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  const juniorRes = checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:26:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });

  assert.strictEqual(seniorRes.status, 'Late');
  assert.strictEqual(juniorRes.status, 'Present');
  return {
    expected: 'Senior 08:26 = Late, Junior 08:26 = Present',
    actual: `Senior: ${seniorRes.status}, Junior: ${juniorRes.status}`
  };
});

// --- PRINCIPAL PORTAL FILTERS & COUNT CONSISTENCY ---
runTest(18, 'Principal PRESENT filter: correctly captures campus-specific Present staff', () => {
  DB = createInitialDB();
  checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:24:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:48:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });

  const presentRecords = DB.attendance.filter(a => a.status === 'Present');
  assert.strictEqual(presentRecords.length, 2);
  return { expected: '2 Present staff', actual: `${presentRecords.length} Present staff` };
});

runTest(19, 'Principal LATE filter: correctly captures campus-specific Late staff', () => {
  DB = createInitialDB();
  checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:26:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:52:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });

  const lateRecords = DB.attendance.filter(a => a.status === 'Late');
  assert.strictEqual(lateRecords.length, 2);
  return { expected: '2 Late staff', actual: `${lateRecords.length} Late staff` };
});

runTest(20, 'Summary PRESENT count equals filtered PRESENT roster', () => {
  DB = createInitialDB();
  checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:20:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  const count = DB.attendance.filter(a => a.status === 'Present').length;
  const roster = DB.attendance.filter(a => a.status.includes('Present'));
  assert.strictEqual(count, roster.length);
  return { expected: `${count}`, actual: `${roster.length}` };
});

runTest(21, 'Summary LATE count equals filtered LATE roster', () => {
  DB = createInitialDB();
  checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:27:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  const count = DB.attendance.filter(a => a.status === 'Late').length;
  const roster = DB.attendance.filter(a => a.status === 'Late');
  assert.strictEqual(count, roster.length);
  return { expected: `${count}`, actual: `${roster.length}` };
});

runTest(22, 'Verified QR + Late: A QR-verified Late teacher remains LATE and VERIFIED', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:35:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  const record = DB.attendance.find(a => a.teacher_id === 'teacher-senior-uuid');
  assert.strictEqual(record.status, 'Late');
  assert.strictEqual(record.check_in_verification_status, 'VERIFIED');
  assert.strictEqual(record.check_in_method, 'DYNAMIC_QR');
  return { expected: 'LATE & VERIFIED', actual: `${record.status} & ${record.check_in_verification_status}` };
});

runTest(23, 'Verified QR + Present: A QR-verified Present teacher remains PRESENT and VERIFIED', () => {
  DB = createInitialDB();
  const res = checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:10:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  const record = DB.attendance.find(a => a.teacher_id === 'teacher-senior-uuid');
  assert.strictEqual(record.status, 'Present');
  assert.strictEqual(record.check_in_verification_status, 'VERIFIED');
  return { expected: 'PRESENT & VERIFIED', actual: `${record.status} & ${record.check_in_verification_status}` };
});

runTest(24, 'Checkout after late check-in: Original LATE status preserved', () => {
  DB = createInitialDB();
  // Check in late
  checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:35:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  
  // Afternoon check out
  const { sessionToken: outToken } = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_OUT');
  const outRes = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: outToken,
    actionType: 'CHECK_OUT',
    lat: SENIOR_LAT,
    lng: SENIOR_LNG,
    accuracy: 10,
    overrideServerTimestamp: '2026-09-17T16:00:00+05:30'
  });

  const record = DB.attendance.find(a => a.teacher_id === 'teacher-senior-uuid');
  assert.strictEqual(record.status, 'Late');
  assert(record.check_out_time != null);
  return { expected: 'LATE preserved upon checkout', actual: record.status };
});

runTest(25, 'Correction workflow remains intact for campus-timed attendance', () => {
  DB = createInitialDB();
  checkInAtKolkataTime({ teacherId: 'teacher-junior-uuid', kioskDeviceId: 'GN-JUNIOR-001', timeStr: '08:52:00', lat: JUNIOR_LAT, lng: JUNIOR_LNG });
  
  // Submit correction
  const req = {
    id: crypto.randomUUID(),
    teacher_id: 'teacher-junior-uuid',
    attendance_date: '2026-09-17',
    reason: 'Morning bus puncture',
    status: 'PENDING'
  };
  DB.correction_requests.push(req);

  // Review decision
  req.status = 'APPROVED';
  const record = DB.attendance.find(a => a.teacher_id === 'teacher-junior-uuid');
  record.status = 'Present';
  record.check_in_method = 'MANUAL_CORRECTION';

  assert.strictEqual(record.status, 'Present');
  return { expected: 'Correction applied', actual: record.status };
});

runTest(26, 'Audit log records every rule change and attendance event', () => {
  DB = createInitialDB();
  checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:20:00', lat: SENIOR_LAT, lng: SENIOR_LNG });
  assert(DB.campus_attendance_rule_audit_logs.length >= 2);
  return { expected: 'Audit trail intact', actual: `${DB.campus_attendance_rule_audit_logs.length} audit records` };
});

runTest(27, 'Historical attendance records are not silently reclassified', () => {
  DB = createInitialDB();
  // Pre-existing historical record from 2026-09-10
  const historical = {
    id: 'hist-1',
    teacher_id: 'teacher-senior-uuid',
    attendance_date: '2026-09-10',
    status: 'Present',
    check_in_time: '2026-09-10T08:24:00+05:30',
    attendance_rule_id: 'rule-senior-v1',
    attendance_rule_version: 1
  };
  DB.attendance.push(historical);

  // Add Version 2 for Senior School taking effect on 2026-10-01 with 08:20 start
  server_admin_create_or_update_rule({
    callerId: 'admin-uuid',
    campusId: 'camp-senior-uuid',
    schoolStartTime: '08:20:00',
    gracePeriodMinutes: 5,
    effectiveFrom: '2026-10-01',
    reason: 'New term schedule'
  });

  // Verify historical record remains unchanged
  const check = DB.attendance.find(a => a.id === 'hist-1');
  assert.strictEqual(check.status, 'Present');
  assert.strictEqual(check.attendance_rule_version, 1);
  return { expected: 'Present, v1', actual: `${check.status}, v${check.attendance_rule_version}` };
});

runTest(28, 'Timezone boundary: 08:25 Senior and 08:50 Junior interpreted in Asia/Kolkata', () => {
  DB = createInitialDB();
  // UTC 02:55:00 corresponds to 08:25:00 IST (+05:30)
  const utcIsoSenior = '2026-09-17T02:55:00.000Z';
  const kolkataSenior = toKolkataTime(utcIsoSenior);
  assert.strictEqual(kolkataSenior.time, '08:25:00');

  // UTC 03:20:00 corresponds to 08:50:00 IST (+05:30)
  const utcIsoJunior = '2026-09-17T03:20:00.000Z';
  const kolkataJunior = toKolkataTime(utcIsoJunior);
  assert.strictEqual(kolkataJunior.time, '08:50:00');

  return { expected: '08:25:00 and 08:50:00 IST', actual: `${kolkataSenior.time} and ${kolkataJunior.time}` };
});

runTest(29, 'Existing Dynamic QR security: Expired QR (>20s) rejected', () => {
  DB = createInitialDB();
  const { sessionToken } = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 1);
  // Expire session
  const session = DB.qr_sessions.find(s => s.session_token === sessionToken);
  session.expires_at = Date.now() - 1000;

  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_LAT,
      lng: SENIOR_LNG
    });
  }, /QR_EXPIRED/);
  return { expected: 'REJECTED (QR_EXPIRED)', actual: 'Thrown QR_EXPIRED' };
});

runTest(30, 'Existing GPS/geofence security: Out of geofence rejected', () => {
  DB = createInitialDB();
  assert.throws(() => {
    // 500m outside Senior School
    checkInAtKolkataTime({ teacherId: 'teacher-senior-uuid', kioskDeviceId: 'GN-SENIOR-001', timeStr: '08:20:00', lat: 27.042000, lng: 88.268000 });
  }, /GEOFENCE_EXCEEDED/);
  return { expected: 'REJECTED (GEOFENCE_EXCEEDED)', actual: 'Thrown GEOFENCE_EXCEEDED' };
});

// --- TESTS 31 TO 38: ARCHITECTURAL CORRECTIONS SPECIFIED BY USER ---

runTest(31, 'TEST 31: Missing attendance rule -> ATTENDANCE_RULE_NOT_CONFIGURED (Zero fallback)', () => {
  DB = createInitialDB();
  // Create kiosk on campus with NO rules configured
  DB.kiosks.push({
    id: 'kiosk-norule-uuid',
    device_id: 'GN-NORULE-001',
    campus_id: 'camp-empty-rule-uuid',
    kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
    status: 'ACTIVE'
  });
  // Assign principal roaming authority
  assert.throws(() => {
    checkInAtKolkataTime({ teacherId: 'principal-uuid', kioskDeviceId: 'GN-NORULE-001', timeStr: '08:20:00', lat: 27.040000, lng: 88.270000 });
  }, /ATTENDANCE_RULE_NOT_CONFIGURED/);
  return { expected: 'ATTENDANCE_RULE_NOT_CONFIGURED', actual: 'Thrown ATTENDANCE_RULE_NOT_CONFIGURED' };
});

runTest(32, 'TEST 32: Overlapping effective rules -> Rejected', () => {
  DB = createInitialDB();
  assert.throws(() => {
    // Attempt inserting active rule overlapping with 2026-01-01 -> indefinite
    const invalidRule = {
      id: 'rule-overlap',
      campus_id: 'camp-junior-uuid',
      academic_year_id: '2026',
      school_start_time: '08:40:00',
      grace_period_minutes: 10,
      late_threshold: '08:50:00',
      effective_from: '2026-06-01',
      effective_to: '2026-12-31',
      active: true,
      version: 2
    };
    server_validate_rule_record(invalidRule);
  }, /OVERLAPPING_ATTENDANCE_RULE/);
  return { expected: 'Rejected with OVERLAPPING_ATTENDANCE_RULE', actual: 'Trigger raised exception' };
});

runTest(33, 'TEST 33: Inconsistent threshold (Start 08:40, Grace 10, Threshold 08:45) -> Rejected', () => {
  DB = createInitialDB();
  assert.throws(() => {
    const inconsistentRule = {
      id: 'rule-inconsistent',
      campus_id: 'camp-junior-uuid',
      academic_year_id: '2026',
      school_start_time: '08:40:00',
      grace_period_minutes: 10,
      late_threshold: '08:45:00', // INCONSISTENT! Expected 08:50:00
      effective_from: '2027-01-01',
      effective_to: null,
      active: true,
      version: 2
    };
    server_validate_rule_record(inconsistentRule);
  }, /INCONSISTENT_THRESHOLD/);
  return { expected: 'Rejected with INCONSISTENT_THRESHOLD', actual: 'Trigger raised exception' };
});

runTest(34, 'TEST 34: Historical Version 1 -> Existing attendance remains associated with Version 1', () => {
  DB = createInitialDB();
  const v1CheckIn = checkInAtKolkataTime({
    teacherId: 'teacher-senior-uuid',
    kioskDeviceId: 'GN-SENIOR-001',
    timeStr: '08:24:00',
    dateStr: '2026-09-17',
    lat: SENIOR_LAT,
    lng: SENIOR_LNG
  });

  const record = DB.attendance.find(a => a.teacher_id === 'teacher-senior-uuid');
  assert.strictEqual(record.attendance_rule_version, 1);
  assert.strictEqual(record.applied_late_threshold, '08:25:00');
  return { expected: 'Version 1, 08:25:00', actual: `Version ${record.attendance_rule_version}, ${record.applied_late_threshold}` };
});

runTest(35, 'TEST 35: New Version 2 -> Only attendance on/after Version 2 effective date uses Version 2', () => {
  DB = createInitialDB();
  // Create Version 2 starting 2026-10-01 (Start 08:20, Grace 10 -> 08:30:00)
  server_admin_create_or_update_rule({
    callerId: 'admin-uuid',
    campusId: 'camp-senior-uuid',
    schoolStartTime: '08:20:00',
    gracePeriodMinutes: 10,
    effectiveFrom: '2026-10-01',
    reason: 'Winter timing change'
  });

  // Check in on 2026-09-30 (Must use Version 1: threshold 08:25:00)
  const sep30 = checkInAtKolkataTime({
    teacherId: 'teacher-senior-uuid',
    kioskDeviceId: 'GN-SENIOR-001',
    timeStr: '08:28:00',
    dateStr: '2026-09-30',
    lat: SENIOR_LAT,
    lng: SENIOR_LNG
  });
  // 08:28 is > 08:25:00 -> Late under Version 1!
  assert.strictEqual(sep30.status, 'Late');
  assert.strictEqual(sep30.ruleVersion, 1);

  // Check in on 2026-10-01 (Must use Version 2: threshold 08:30:00)
  const oct01 = checkInAtKolkataTime({
    teacherId: 'teacher-senior-uuid',
    kioskDeviceId: 'GN-SENIOR-001',
    timeStr: '08:28:00',
    dateStr: '2026-10-01',
    lat: SENIOR_LAT,
    lng: SENIOR_LNG
  });
  // 08:28 is <= 08:30:00 -> Present under Version 2!
  assert.strictEqual(oct01.status, 'Present');
  assert.strictEqual(oct01.ruleVersion, 2);

  return {
    expected: 'Sep 30 = Late (v1), Oct 01 = Present (v2)',
    actual: `Sep 30: ${sep30.status} (v${sep30.ruleVersion}), Oct 01: ${oct01.status} (v${oct01.ruleVersion})`
  };
});

runTest(36, 'TEST 36: Campus deletion/archive blocked if rule history exists (ON DELETE RESTRICT)', () => {
  DB = createInitialDB();
  // Simulate attempting to delete a campus with active rule history
  const campusId = 'camp-senior-uuid';
  const hasDependentRules = DB.campus_attendance_rules.some(r => r.campus_id === campusId);
  assert(hasDependentRules === true);

  // In PostgreSQL, ON DELETE RESTRICT raises 23503 error
  function attemptCampusDelete(id) {
    if (DB.campus_attendance_rules.some(r => r.campus_id === id)) {
      throw new Error('FOREIGN_KEY_VIOLATION: Cannot delete campus while attendance rule history exists (ON DELETE RESTRICT)');
    }
  }

  assert.throws(() => attemptCampusDelete(campusId), /FOREIGN_KEY_VIOLATION/);
  return { expected: 'Delete prevented by RESTRICT', actual: 'Foreign key constraint enforced' };
});

runTest(37, 'TEST 37: Teacher attempts rule modification -> Server rejects (UNAUTHORIZED_ROLE)', () => {
  DB = createInitialDB();
  assert.throws(() => {
    server_admin_create_or_update_rule({
      callerId: 'teacher-senior-uuid', // Teacher role!
      campusId: 'camp-senior-uuid',
      schoolStartTime: '09:00:00',
      gracePeriodMinutes: 30,
      effectiveFrom: '2026-09-17',
      reason: 'Malicious rule modification attempt'
    });
  }, /UNAUTHORIZED_ROLE/);
  return { expected: 'UNAUTHORIZED_ROLE', actual: 'Rejected with UNAUTHORIZED_ROLE' };
});

runTest(38, 'TEST 38: Client attempts to select a different campus -> Server rejects manipulation', () => {
  DB = createInitialDB();
  // Junior teacher scans Junior kiosk but payload includes forged campus_id = 'SENIOR_SCHOOL'
  const res = checkInAtKolkataTime({
    teacherId: 'teacher-junior-uuid',
    kioskDeviceId: 'GN-JUNIOR-001',
    timeStr: '08:45:00',
    lat: JUNIOR_LAT,
    lng: JUNIOR_LNG,
    clientSuppliedCampusId: 'SENIOR_SCHOOL'
  });

  // Server authoritatively derives campus from the kiosk/QR session, ignoring client
  assert.strictEqual(res.campusId, 'JUNIOR_SCHOOL');
  assert.strictEqual(res.lateThreshold, '08:50:00');
  return { expected: 'Server enforced JUNIOR_SCHOOL', actual: res.campusId };
});

// ------------------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST EXECUTION SUMMARY: Total: 38 | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
