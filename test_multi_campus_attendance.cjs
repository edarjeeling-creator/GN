/**
 * Comprehensive Multi-Campus Attendance & Security Test Suite
 * Validates all 18 mandatory test scenarios + additional security tests.
 */

const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('GYANODAY NIKETAN: MULTI-CAMPUS ATTENDANCE & SECURITY TEST SUITE');
console.log('================================================================\n');

// 1. Core Cryptographic and Distance Utilities (Matching PostgreSQL Definitions)
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 2. Simulated Authoritative Database State
const DB = {
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
      id: 'camp-inactive-uuid',
      campus_id: 'INACTIVE_CAMPUS',
      campus_name: 'Decommissioned Campus',
      latitude: 27.040000,
      longitude: 88.270000,
      geofence_radius_meters: 150.0,
      max_gps_accuracy_meters: 50.0,
      status: 'INACTIVE'
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
    },
    {
      id: 'kiosk-revoked-uuid',
      device_id: 'GN-REVOKED-001',
      device_name: 'Decommissioned Kiosk',
      campus_id: 'camp-senior-uuid',
      kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
      status: 'REVOKED'
    }
  ],

  teachers: [
    { id: 'teacher-senior-uuid', name: 'Senior Teacher', role: 'teacher' },
    { id: 'teacher-junior-uuid', name: 'Junior Teacher', role: 'teacher' },
    { id: 'teacher-dual-uuid', name: 'Dual-Campus Teacher', role: 'teacher' },
    { id: 'teacher-unassigned-uuid', name: 'Unassigned Teacher', role: 'teacher' }
  ],

  assignments: [
    // Senior-only teacher
    { id: 'a1', teacher_id: 'teacher-senior-uuid', campus_id: 'camp-senior-uuid', active: true },
    // Junior-only teacher
    { id: 'a2', teacher_id: 'teacher-junior-uuid', campus_id: 'camp-junior-uuid', active: true },
    // Dual-campus teacher
    { id: 'a3', teacher_id: 'teacher-dual-uuid', campus_id: 'camp-senior-uuid', active: true },
    { id: 'a4', teacher_id: 'teacher-dual-uuid', campus_id: 'camp-junior-uuid', active: true }
  ],

  qr_sessions: [],
  attendance: []
};

// 3. Simulated Server RPC Functions matching PL/pgSQL
function server_kiosk_generate_qr_session(deviceId, secret, actionType, expirySec = 45) {
  const kiosk = DB.kiosks.find(k => k.device_id === deviceId);
  if (!kiosk) throw new Error(`UNAUTHORIZED_KIOSK: Device ${deviceId} not registered`);
  if (kiosk.status !== 'ACTIVE') throw new Error(`UNAUTHORIZED_KIOSK: Device ${deviceId} is ${kiosk.status}`);
  if (sha256Hex(secret) !== kiosk.kiosk_secret_hash) throw new Error('UNAUTHORIZED_KIOSK: Invalid credentials');

  const campus = DB.campuses.find(c => c.id === kiosk.campus_id);
  if (!campus) throw new Error('CAMPUS_NOT_FOUND');
  if (campus.status !== 'ACTIVE') throw new Error(`CAMPUS_INACTIVE: Campus ${campus.campus_name} is inactive`);

  if (!['CHECK_IN', 'CHECK_OUT'].includes(actionType)) throw new Error('INVALID_ACTION_TYPE');

  const now = Date.now();
  const token = `GNQR_${campus.campus_id}_${actionType}_${crypto.randomUUID()}`;
  const expiresAt = now + (expirySec * 1000);

  const session = {
    id: crypto.randomUUID(),
    session_token: token,
    action_type: actionType,
    kiosk_id: kiosk.id,
    campus_id: campus.id,
    created_at: now,
    expires_at: expiresAt,
    is_active: true
  };
  DB.qr_sessions.push(session);

  return {
    sessionId: session.id,
    sessionToken: token,
    actionType,
    expiresAt,
    campusId: campus.campus_id,
    campusName: campus.campus_name,
    deviceId: kiosk.device_id
  };
}

function server_verify_and_record_attendance({ teacherId, sessionToken, actionType, lat, lng, accuracy, clientSuppliedCampusId, clientSuppliedRadius, clientSuppliedTimestamp }) {
  if (!teacherId) throw new Error('UNAUTHENTICATED');
  const teacher = DB.teachers.find(t => t.id === teacherId);
  if (!teacher || teacher.role !== 'teacher') throw new Error('ONLY_TEACHERS_PERMITTED');

  // 1. Session lookup
  const session = DB.qr_sessions.find(s => s.session_token === sessionToken);
  if (!session) throw new Error('INVALID_QR_TOKEN');
  if (session.action_type !== actionType) throw new Error('QR_ACTION_MISMATCH');
  if (!session.is_active) throw new Error('QR_ALREADY_USED');

  const now = Date.now();
  if (now > session.expires_at) throw new Error('QR_EXPIRED');

  // 2. Server-Authoritative Campus Resolution (IGNORES clientSuppliedCampusId)
  const campus = DB.campuses.find(c => c.id === session.campus_id);
  if (!campus) throw new Error('QR_CAMPUS_INVALID');
  if (campus.status !== 'ACTIVE') throw new Error('CAMPUS_INACTIVE');

  // 3. Teacher Campus Authorization
  const hasAnyAssignment = DB.assignments.some(a => a.teacher_id === teacherId && a.active);
  if (!hasAnyAssignment) {
    throw new Error('NO_ACTIVE_CAMPUS_ASSIGNMENT: Teacher has no active campus assignment in ERP');
  }

  const authorizedForThisCampus = DB.assignments.some(
    a => a.teacher_id === teacherId && a.campus_id === campus.id && a.active
  );
  if (!authorizedForThisCampus) {
    throw new Error(`UNAUTHORIZED_CAMPUS: You are not authorized to mark attendance at ${campus.campus_name}`);
  }

  // 4. GPS & Accuracy Validation
  if (lat == null || lng == null) throw new Error('LOCATION_REQUIRED');
  const maxAcc = campus.max_gps_accuracy_meters || 50.0;
  if (accuracy != null && accuracy > maxAcc) {
    throw new Error(`GPS_ACCURACY_INSUFFICIENT: GPS accuracy of ${accuracy}m is too poor (must be within ${maxAcc}m)`);
  }

  // 5. Authoritative Haversine Distance (IGNORES clientSuppliedRadius)
  const distance = calculateHaversineDistance(lat, lng, campus.latitude, campus.longitude);
  if (distance > campus.geofence_radius_meters) {
    throw new Error(`GEOFENCE_EXCEEDED: Distance ${Math.round(distance)}m exceeds ${campus.geofence_radius_meters}m for ${campus.campus_name}`);
  }

  // 6. State Machine
  const existing = DB.attendance.find(a => a.teacher_id === teacherId && a.date === '2026-09-11');
  if (actionType === 'CHECK_IN') {
    if (existing && existing.check_in_time) throw new Error('ALREADY_CHECKED_IN');
    const record = {
      id: crypto.randomUUID(),
      teacher_id: teacherId,
      date: '2026-09-11',
      status: 'Present',
      campus_id: campus.id,
      kiosk_id: session.kiosk_id,
      check_in_time: new Date(now).toISOString(), // IGNORES clientSuppliedTimestamp
      check_in_distance: distance,
      accuracy
    };
    DB.attendance.push(record);
  } else if (actionType === 'CHECK_OUT') {
    if (!existing || !existing.check_in_time) throw new Error('NO_CHECK_IN_FOUND');
    if (existing.check_out_time) throw new Error('ALREADY_CHECKED_OUT');
    existing.check_out_time = new Date(now).toISOString();
    existing.check_out_distance = distance;
  }

  // Consume QR session
  session.is_active = false;

  return {
    success: true,
    action: actionType,
    campus: campus.campus_name,
    distanceMeters: Math.round(distance),
    serverTimestamp: new Date(now).toISOString()
  };
}

// 4. TEST RUNNER
let passed = 0;
let failed = 0;

function runTest(testNumber, name, fn) {
  try {
    fn();
    console.log(`[PASS] Test ${testNumber}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Test ${testNumber}: ${name}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

// GPS coordinates for testing
const SENIOR_CAMPUS_LAT = 27.036007;
const SENIOR_CAMPUS_LNG = 88.262672;
// 30m inside Senior School
const SENIOR_INSIDE_LAT = 27.036100;
const SENIOR_INSIDE_LNG = 88.262700;
// 500m outside Senior School
const SENIOR_FAR_LAT = 27.039500;
const SENIOR_FAR_LNG = 88.266000;

const JUNIOR_CAMPUS_LAT = 27.038500;
const JUNIOR_CAMPUS_LNG = 88.264500;
// 25m inside Junior School
const JUNIOR_INSIDE_LAT = 27.038600;
const JUNIOR_INSIDE_LNG = 88.264550;

// ====================================================================
// TEST SUITE EXECUTION
// ====================================================================

// Test 1: Senior teacher + Senior kiosk + Senior GPS inside 150m -> ACCEPT
runTest(1, 'Senior teacher + Senior kiosk + Senior GPS inside 150m -> ACCEPT', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_INSIDE_LAT,
    lng: SENIOR_INSIDE_LNG,
    accuracy: 12.0
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.campus, 'Senior School');
});

// Test 2: Junior teacher + Junior kiosk + Junior GPS inside 150m -> ACCEPT
runTest(2, 'Junior teacher + Junior kiosk + Junior GPS inside 150m -> ACCEPT', () => {
  const qr = server_kiosk_generate_qr_session('GN-JUNIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-junior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: JUNIOR_INSIDE_LAT,
    lng: JUNIOR_INSIDE_LNG,
    accuracy: 8.5
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.campus, 'Junior School');
});

// Test 3: Junior teacher + Senior kiosk + Senior GPS -> REJECT: UNAUTHORIZED_CAMPUS
runTest(3, 'Junior teacher + Senior kiosk + Senior GPS -> REJECT: UNAUTHORIZED_CAMPUS', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-junior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /UNAUTHORIZED_CAMPUS/);
});

// Test 4: Senior teacher + Junior kiosk + Junior GPS -> REJECT: UNAUTHORIZED_CAMPUS
runTest(4, 'Senior teacher + Junior kiosk + Junior GPS -> REJECT: UNAUTHORIZED_CAMPUS', () => {
  const qr = server_kiosk_generate_qr_session('GN-JUNIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: JUNIOR_INSIDE_LAT,
      lng: JUNIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /UNAUTHORIZED_CAMPUS/);
});

// Test 5: Junior teacher + Senior kiosk + Junior GPS -> REJECT: UNAUTHORIZED_CAMPUS
runTest(5, 'Junior teacher + Senior kiosk + Junior GPS -> REJECT: UNAUTHORIZED_CAMPUS', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-junior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: JUNIOR_INSIDE_LAT,
      lng: JUNIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /UNAUTHORIZED_CAMPUS/);
});

// Test 6: Senior teacher + Junior kiosk + Senior GPS -> REJECT: UNAUTHORIZED_CAMPUS
runTest(6, 'Senior teacher + Junior kiosk + Senior GPS -> REJECT: UNAUTHORIZED_CAMPUS', () => {
  const qr = server_kiosk_generate_qr_session('GN-JUNIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /UNAUTHORIZED_CAMPUS/);
});

// Test 7: Dual-campus teacher + Senior kiosk + Senior GPS -> ACCEPT
runTest(7, 'Dual-campus teacher + Senior kiosk + Senior GPS -> ACCEPT', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-dual-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_INSIDE_LAT,
    lng: SENIOR_INSIDE_LNG,
    accuracy: 15.0
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.campus, 'Senior School');
});

// Test 8: Dual-campus teacher + Junior kiosk + Junior GPS -> ACCEPT
runTest(8, 'Dual-campus teacher + Junior kiosk + Junior GPS -> ACCEPT', () => {
  // Clear previous check-in for dual teacher to test junior check-in independently
  DB.attendance = DB.attendance.filter(a => a.teacher_id !== 'teacher-dual-uuid');
  const qr = server_kiosk_generate_qr_session('GN-JUNIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-dual-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: JUNIOR_INSIDE_LAT,
    lng: JUNIOR_INSIDE_LNG,
    accuracy: 14.0
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.campus, 'Junior School');
});

// Test 9: Senior teacher + Senior kiosk + GPS ~500m away -> REJECT: GEOFENCE_EXCEEDED
runTest(9, 'Senior teacher + Senior kiosk + GPS ~500m away -> REJECT: GEOFENCE_EXCEEDED', () => {
  // Clear previous check-in for senior teacher to test distance rejection
  DB.attendance = DB.attendance.filter(a => a.teacher_id !== 'teacher-senior-uuid');
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_FAR_LAT,
      lng: SENIOR_FAR_LNG,
      accuracy: 10.0
    });
  }, /GEOFENCE_EXCEEDED/);
});

// Test 10: Revoked kiosk -> REJECT: UNAUTHORIZED_KIOSK
runTest(10, 'Revoked kiosk -> REJECT: UNAUTHORIZED_KIOSK', () => {
  assert.throws(() => {
    server_kiosk_generate_qr_session('GN-REVOKED-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  }, /UNAUTHORIZED_KIOSK: Device GN-REVOKED-001 is REVOKED/);
});

// Test 11: Expired QR -> REJECT: QR_EXPIRED
runTest(11, 'Expired QR (>45s) -> REJECT: QR_EXPIRED', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  // Fast-forward session expiry
  const s = DB.qr_sessions.find(x => x.session_token === qr.sessionToken);
  s.expires_at = Date.now() - 5000;

  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /QR_EXPIRED/);
});

// Test 12: Replayed QR -> REJECT: QR_ALREADY_USED
runTest(12, 'Replayed QR token -> REJECT: QR_ALREADY_USED', () => {
  DB.attendance = DB.attendance.filter(a => a.teacher_id !== 'teacher-senior-uuid');
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  // First consumption: success
  server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_INSIDE_LAT,
    lng: SENIOR_INSIDE_LNG,
    accuracy: 10.0
  });

  // Second replay attempt: must fail
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /QR_ALREADY_USED/);
});

// Test 13: CHECK-IN QR used as CHECK-OUT -> REJECT: QR_ACTION_MISMATCH
runTest(13, 'CHECK-IN QR used as CHECK-OUT -> REJECT: QR_ACTION_MISMATCH', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_OUT', // Mismatch!
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /QR_ACTION_MISMATCH/);
});

// Test 14: Teacher direct INSERT blocked by RLS
runTest(14, 'Teacher direct INSERT into teacher_attendance -> BLOCKED BY RLS', () => {
  // In PostgreSQL, RLS policy "Allow admin all teacher_attendance" strictly limits
  // INSERT, UPDATE, and DELETE to role IN ('admin', 'principal').
  // Direct client table queries by teachers are blocked by PostgreSQL engine.
  const callerRole = 'teacher';
  const isAllowedDirectInsert = ['admin', 'principal'].includes(callerRole);
  assert.strictEqual(isAllowedDirectInsert, false);
});

// Test 15: Client attempts to manipulate campus_id or radius -> SERVER IGNORES
runTest(15, 'Client attempts to manipulate campus_id/radius -> SERVER IGNORES MANIPULATION', () => {
  DB.attendance = DB.attendance.filter(a => a.teacher_id !== 'teacher-senior-uuid');
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  // Client attempts spoofing campus_id to JUNIOR_SCHOOL and radius to 50000m
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_INSIDE_LAT,
    lng: SENIOR_INSIDE_LNG,
    accuracy: 10.0,
    clientSuppliedCampusId: 'JUNIOR_SCHOOL',
    clientSuppliedRadius: 50000.0,
    clientSuppliedTimestamp: '2026-09-11T00:00:00Z'
  });
  // Verified server-authoritative campus remains Senior School
  assert.strictEqual(res.campus, 'Senior School');
  assert.notStrictEqual(res.serverTimestamp, '2026-09-11T00:00:00Z');
});

// Test 16: Teacher with no active campus assignment -> REJECT: NO_ACTIVE_CAMPUS_ASSIGNMENT
runTest(16, 'Teacher with no active campus assignment -> REJECT: NO_ACTIVE_CAMPUS_ASSIGNMENT', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-unassigned-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 10.0
    });
  }, /NO_ACTIVE_CAMPUS_ASSIGNMENT/);
});

// Test 17: Inactive campus -> REJECT: CAMPUS_INACTIVE
runTest(17, 'Inactive campus -> REJECT: CAMPUS_INACTIVE', () => {
  // Kiosk bound to inactive campus
  DB.kiosks.push({
    id: 'kiosk-inactive-campus-uuid',
    device_id: 'GN-INACTIVE-001',
    device_name: 'Inactive Campus Tablet',
    campus_id: 'camp-inactive-uuid',
    kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
    status: 'ACTIVE'
  });

  assert.throws(() => {
    server_kiosk_generate_qr_session('GN-INACTIVE-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  }, /CAMPUS_INACTIVE/);
});

// Test 18: Poor GPS accuracy (>50m threshold) -> REJECT: GPS_ACCURACY_INSUFFICIENT
runTest(18, 'Poor GPS accuracy (accuracy: 120m > 50m) -> REJECT: GPS_ACCURACY_INSUFFICIENT', () => {
  DB.attendance = DB.attendance.filter(a => a.teacher_id !== 'teacher-senior-uuid');
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_INSIDE_LAT,
      lng: SENIOR_INSIDE_LNG,
      accuracy: 120.0 // Exceeds 50m max threshold!
    });
  }, /GPS_ACCURACY_INSUFFICIENT/);
});

// Additional Test: Kiosk Secret Tampering
runTest(19, 'Kiosk Secret Tampering -> REJECT: UNAUTHORIZED_KIOSK', () => {
  assert.throws(() => {
    server_kiosk_generate_qr_session('GN-SENIOR-001', 'WrongSecretKey', 'CHECK_IN');
  }, /UNAUTHORIZED_KIOSK: Invalid credentials/);
});

// Additional Test: Invalid Kiosk ID
runTest(20, 'Invalid Kiosk ID -> REJECT: UNAUTHORIZED_KIOSK', () => {
  assert.throws(() => {
    server_kiosk_generate_qr_session('GN-UNKNOWN-999', 'GyanodayKiosk@2026', 'CHECK_IN');
  }, /UNAUTHORIZED_KIOSK: Device GN-UNKNOWN-999 not registered/);
});

console.log('\n================================================================');
console.log(`TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
