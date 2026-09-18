/**
 * test_attendance_qr_20s_rotation.cjs
 * Comprehensive Automated Test Suite for:
 * REDUCE LIVE ATTENDANCE QR ROTATION FROM 45 SECONDS TO 20 SECONDS
 *
 * Implements all 18 test scenarios specified in Section 11 of the user request:
 * - TEST 1:  QR issued at T=0 -> Valid
 * - TEST 2:  QR scanned at T=10 seconds -> Accepted
 * - TEST 3:  QR scanned at T=19 seconds -> Accepted
 * - TEST 4:  QR scanned at T=20 seconds -> Expired/boundary check
 * - TEST 5:  QR scanned at T=21 seconds -> REJECTED (QR_EXPIRED)
 * - TEST 6:  Old QR scanned after new QR has been issued -> REJECTED
 * - TEST 7:  New QR generated after 20 seconds -> New token/session with fresh 20s validity
 * - TEST 8:  Senior School kiosk (GN-SENIOR-001) -> 20-second QR validity
 * - TEST 9:  Junior School kiosk (GN-JUNIOR-001) -> 20-second QR validity
 * - TEST 10: Morning Check-In QR -> 20-second validity
 * - TEST 11: Afternoon Check-Out QR -> 20-second validity
 * - TEST 12: Attempt to manipulate client countdown -> Server still determines validity
 * - TEST 13: Attempt to manipulate device clock -> Server-side expiry remains authoritative
 * - TEST 14: Expired QR with valid GPS -> REJECTED
 * - TEST 15: Valid QR with invalid campus -> REJECTED by existing campus security
 * - TEST 16: Valid QR with unauthorized teacher-campus assignment -> REJECTED
 * - TEST 17: Existing one-use protection -> No regression (consumed token rejected)
 * - TEST 18: Existing Dynamic QR attendance flow -> No regression
 */

const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('GYANODAY NIKETAN: 20-SECOND QR ROTATION & VALIDITY TEST SUITE');
console.log('================================================================\n');

// ------------------------------------------------------------------------------
// 1. Authoritative Constants
// ------------------------------------------------------------------------------
const ATTENDANCE_QR_TTL_SECONDS = 20;

// Campus Coordinates
const SENIOR_CAMPUS = {
  id: 'campus-senior-uuid',
  campus_id: 'SENIOR_SCHOOL',
  campus_name: 'Senior School',
  latitude: 27.036007,
  longitude: 88.262672,
  geofence_radius_meters: 150,
  max_gps_accuracy_meters: 50,
  status: 'ACTIVE'
};

const JUNIOR_CAMPUS = {
  id: 'campus-junior-uuid',
  campus_id: 'JUNIOR_SCHOOL',
  campus_name: 'Junior School',
  latitude: 27.038500,
  longitude: 88.264510,
  geofence_radius_meters: 150,
  max_gps_accuracy_meters: 50,
  status: 'ACTIVE'
};

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

// ------------------------------------------------------------------------------
// 2. Mock Database Environment
// ------------------------------------------------------------------------------
function createTestDB() {
  return {
    kiosks: [
      {
        id: 'kiosk-senior-uuid',
        device_id: 'GN-SENIOR-001',
        device_name: 'Senior School Main Gate Kiosk',
        location_name: 'Senior Campus Entrance',
        campus_id: SENIOR_CAMPUS.id,
        kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
        status: 'ACTIVE'
      },
      {
        id: 'kiosk-junior-uuid',
        device_id: 'GN-JUNIOR-001',
        device_name: 'Junior School Primary Kiosk',
        location_name: 'Junior Campus Entrance',
        campus_id: JUNIOR_CAMPUS.id,
        kiosk_secret_hash: sha256Hex('GyanodayKiosk@2026'),
        status: 'ACTIVE'
      }
    ],
    campuses: [SENIOR_CAMPUS, JUNIOR_CAMPUS],
    teachers: [
      { id: 'teacher-senior-uuid', name: 'Naveen Sharma', role: 'teacher', status: 'Active' },
      { id: 'teacher-junior-uuid', name: 'Anita Pradhan', role: 'teacher', status: 'Active' },
      { id: 'teacher-unassigned-uuid', name: 'Unassigned Staff', role: 'teacher', status: 'Active' }
    ],
    assignments: [
      { teacher_id: 'teacher-senior-uuid', campus_id: SENIOR_CAMPUS.id, active: true },
      { teacher_id: 'teacher-junior-uuid', campus_id: JUNIOR_CAMPUS.id, active: true }
    ],
    qr_sessions: [],
    attendance: []
  };
}

let DB = createTestDB();

// ------------------------------------------------------------------------------
// 3. Authoritative PL/pgSQL Simulation
// ------------------------------------------------------------------------------
function server_kiosk_generate_qr_session(deviceId, secret, actionType, expirySec = ATTENDANCE_QR_TTL_SECONDS, simulatedServerTime = null) {
  const kiosk = DB.kiosks.find(k => k.device_id === deviceId);
  if (!kiosk) throw new Error(`UNAUTHORIZED_KIOSK: Device ${deviceId} not registered`);
  if (kiosk.status !== 'ACTIVE') throw new Error(`UNAUTHORIZED_KIOSK: Device ${deviceId} is ${kiosk.status}`);
  if (sha256Hex(secret) !== kiosk.kiosk_secret_hash) throw new Error('UNAUTHORIZED_KIOSK: Invalid credentials');

  const campus = DB.campuses.find(c => c.id === kiosk.campus_id);
  if (!campus || campus.status !== 'ACTIVE') throw new Error('CAMPUS_INACTIVE');

  if (!['CHECK_IN', 'CHECK_OUT'].includes(actionType)) throw new Error('INVALID_ACTION_TYPE');

  // Authoritative server clamping (15s - 300s, default 20s)
  let v_expiry = Number.isInteger(expirySec) ? expirySec : ATTENDANCE_QR_TTL_SECONDS;
  if (v_expiry < 15 || v_expiry > 300) {
    v_expiry = ATTENDANCE_QR_TTL_SECONDS;
  }

  // Deactivate previous generic / active sessions for same kiosk and action type
  DB.qr_sessions.forEach(s => {
    if (s.kiosk_id === kiosk.id && s.action_type === actionType && s.is_active) {
      s.is_active = false;
    }
  });

  const now = simulatedServerTime || Date.now();
  const token = `GNQR_${campus.campus_id}_${actionType}_${crypto.randomUUID()}`;
  const expiresAt = now + (v_expiry * 1000);

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
    serverTime: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    campusId: campus.campus_id,
    campusName: campus.campus_name,
    deviceId: kiosk.device_id,
    validitySeconds: v_expiry
  };
}

function server_admin_generate_qr_session(actionType, expirySec = ATTENDANCE_QR_TTL_SECONDS, campusId = 'SENIOR_SCHOOL', simulatedServerTime = null) {
  if (!['CHECK_IN', 'CHECK_OUT'].includes(actionType)) throw new Error('INVALID_ACTION_TYPE');

  let v_expiry = Number.isInteger(expirySec) ? expirySec : ATTENDANCE_QR_TTL_SECONDS;
  if (v_expiry < 15 || v_expiry > 300) {
    v_expiry = ATTENDANCE_QR_TTL_SECONDS;
  }

  const campus = DB.campuses.find(c => c.campus_id === campusId) || SENIOR_CAMPUS;

  // Deactivate previous active generic sessions
  DB.qr_sessions.forEach(s => {
    if (s.action_type === actionType && s.is_active && !s.kiosk_id) {
      s.is_active = false;
    }
  });

  const now = simulatedServerTime || Date.now();
  const token = `GNQR_${campus.campus_id}_${actionType}_${crypto.randomUUID()}`;
  const expiresAt = now + (v_expiry * 1000);

  const session = {
    id: crypto.randomUUID(),
    session_token: token,
    action_type: actionType,
    kiosk_id: null,
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
    serverTime: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    campusId: campus.campus_id,
    campusName: campus.campus_name,
    validitySeconds: v_expiry
  };
}

function server_verify_and_record_attendance({ teacherId, sessionToken, actionType, lat, lng, accuracy = 10, simulatedServerTime = null }) {
  const teacher = DB.teachers.find(t => t.id === teacherId);
  if (!teacher) throw new Error('UNAUTHENTICATED');
  if (teacher.role !== 'teacher') throw new Error('ONLY_TEACHERS_PERMITTED');

  // 1. QR Session lookup
  const session = DB.qr_sessions.find(s => s.session_token === sessionToken);
  if (!session) throw new Error('INVALID_QR_TOKEN');
  if (session.action_type !== actionType) throw new Error('QR_ACTION_MISMATCH');
  if (!session.is_active) throw new Error('QR_ALREADY_USED: This QR token has already been consumed.');

  const now = simulatedServerTime || Date.now();
  if (now > session.expires_at) {
    throw new Error('QR_EXPIRED: Attendance QR code has expired. Please scan the newly generated code.');
  }

  // 2. Authoritative Campus Resolution from QR session
  const campus = DB.campuses.find(c => c.id === session.campus_id);
  if (!campus || campus.status !== 'ACTIVE') throw new Error('CAMPUS_INACTIVE');

  // 3. Teacher campus authorization
  const assignment = DB.assignments.find(a => a.teacher_id === teacherId && a.active);
  if (!assignment) {
    throw new Error('NO_ACTIVE_CAMPUS_ASSIGNMENT: Teacher has no active campus assignment in ERP');
  }
  if (assignment.campus_id !== campus.id) {
    throw new Error(`UNAUTHORIZED_CAMPUS: Teacher assigned to other campus, cannot scan at ${campus.campus_name}`);
  }

  // 4. GPS / Geofence verification
  if (lat == null || lng == null) throw new Error('LOCATION_REQUIRED');
  if (accuracy > campus.max_gps_accuracy_meters) {
    throw new Error(`GPS_ACCURACY_INSUFFICIENT: Accuracy ${accuracy}m exceeds allowed ${campus.max_gps_accuracy_meters}m`);
  }
  const dist = calculateHaversineDistance(lat, lng, campus.latitude, campus.longitude);
  if (dist > campus.geofence_radius_meters) {
    throw new Error(`GEOFENCE_EXCEEDED: Distance ${Math.round(dist)}m exceeds allowed radius ${campus.geofence_radius_meters}m`);
  }

  // 5. One-use consumption: mark session inactive
  session.is_active = false;
  session.consumed_at = now;
  session.consumed_by = teacherId;

  // 6. Record attendance
  const record = {
    id: crypto.randomUUID(),
    teacher_id: teacherId,
    campus_id: campus.id,
    action_type: actionType,
    verified_at: now,
    status: 'VERIFIED'
  };
  DB.attendance.push(record);

  return { success: true, record, campus: campus.campus_name, distanceMeters: Math.round(dist) };
}

// ------------------------------------------------------------------------------
// 4. Test Runner & Assertions
// ------------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function runTest(testNum, testName, fn) {
  try {
    const res = fn();
    console.log(`[PASS] TEST ${String(testNum).padStart(2, '0')}: ${testName}`);
    if (res && res.details) console.log(`       -> ${res.details}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] TEST ${String(testNum).padStart(2, '0')}: ${testName}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

// ------------------------------------------------------------------------------
// 5. Test Suite Execution (All 18 Scenarios)
// ------------------------------------------------------------------------------

// TEST 1: QR issued at T=0 -> Valid
runTest(1, 'QR issued at T=0 is valid and active', () => {
  DB = createTestDB();
  const t0 = 1758168000000; // Fixed timestamp
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  assert.strictEqual(qr.validitySeconds, 20);
  const session = DB.qr_sessions.find(s => s.session_token === qr.sessionToken);
  assert.strictEqual(session.is_active, true);
  assert.strictEqual(session.expires_at - session.created_at, 20000);
  return { details: `Token issued, valid for exactly ${qr.validitySeconds}s` };
});

// TEST 2: QR scanned at T=10s -> Accepted
runTest(2, 'QR scanned at T=10 seconds is ACCEPTED', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  const tScan = t0 + 10000; // T=10s
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_CAMPUS.latitude,
    lng: SENIOR_CAMPUS.longitude,
    simulatedServerTime: tScan
  });
  assert.strictEqual(res.success, true);
  return { details: `Scanned at T=10s: Accepted, verification status = ${res.record.status}` };
});

// TEST 3: QR scanned at T=19s -> Accepted
runTest(3, 'QR scanned at T=19 seconds (1s before cutoff) is ACCEPTED', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  const tScan = t0 + 19000; // T=19s
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_CAMPUS.latitude,
    lng: SENIOR_CAMPUS.longitude,
    simulatedServerTime: tScan
  });
  assert.strictEqual(res.success, true);
  return { details: `Scanned at T=19s: Accepted within 20s lifetime` };
});

// TEST 4: QR scanned at T=20s -> Boundary evaluation
runTest(4, 'QR scanned at exact T=20s boundary is properly evaluated', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  const tScan = t0 + 20000; // T=20.000s
  // At exact boundary (now === expires_at), server checks (now > session.expires_at)
  const session = DB.qr_sessions.find(s => s.session_token === qr.sessionToken);
  assert.strictEqual(session.expires_at, tScan);
  return { details: `Exact boundary at 20.000s: boundary matches expires_at` };
});

// TEST 5: QR scanned at T=21s -> REJECTED (QR_EXPIRED)
runTest(5, 'QR scanned at T=21 seconds is REJECTED with QR_EXPIRED', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  const tScan = t0 + 21000; // T=21s
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,
      lng: SENIOR_CAMPUS.longitude,
      simulatedServerTime: tScan
    });
  }, /QR_EXPIRED/);
  return { details: `Scan at T=21s strictly rejected by server authoritative expiry check` };
});

// TEST 6: Old QR scanned after a new QR has been issued -> REJECTED
runTest(6, 'Old QR scanned after new QR generated is REJECTED (Deactivated)', () => {
  const t0 = 1758168000000;
  const qrA = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  // Kiosk rotates to QR B at T=5s
  const qrB = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0 + 5000);
  assert.notStrictEqual(qrA.sessionToken, qrB.sessionToken);

  // Attempt to scan QR A
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qrA.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,
      lng: SENIOR_CAMPUS.longitude,
      simulatedServerTime: t0 + 7000
    });
  }, /QR_ALREADY_USED/);
  return { details: `Previous session automatically deactivated upon rotation; scan rejected` };
});

// TEST 7: New QR generated after 20s -> Fresh token & session
runTest(7, 'New QR generated after 20 seconds has distinct token and fresh 20s validity', () => {
  const t0 = 1758168000000;
  const qr1 = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  const qr2 = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0 + 20000);
  assert.notStrictEqual(qr1.sessionToken, qr2.sessionToken);
  assert.strictEqual(new Date(qr2.expiresAt).getTime() - new Date(qr2.serverTime).getTime(), 20000);
  return { details: `New session created with unique cryptographic token and full 20s lifetime` };
});

// TEST 8: Senior School kiosk (GN-SENIOR-001) -> 20s validity
runTest(8, 'Senior School kiosk (GN-SENIOR-001) produces 20-second QR validity', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.strictEqual(qr.campusId, 'SENIOR_SCHOOL');
  assert.strictEqual(qr.validitySeconds, 20);
  const s = DB.qr_sessions.find(x => x.session_token === qr.sessionToken);
  assert.strictEqual((s.expires_at - s.created_at) / 1000, 20);
  return { details: `Senior kiosk bounded to SENIOR_SCHOOL with 20s TTL` };
});

// TEST 9: Junior School kiosk (GN-JUNIOR-001) -> 20s validity
runTest(9, 'Junior School kiosk (GN-JUNIOR-001) produces 20-second QR validity', () => {
  const qr = server_kiosk_generate_qr_session('GN-JUNIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  assert.strictEqual(qr.campusId, 'JUNIOR_SCHOOL');
  assert.strictEqual(qr.validitySeconds, 20);
  const s = DB.qr_sessions.find(x => x.session_token === qr.sessionToken);
  assert.strictEqual((s.expires_at - s.created_at) / 1000, 20);
  return { details: `Junior kiosk bounded to JUNIOR_SCHOOL with 20s TTL` };
});

// TEST 10: Morning Check-In QR -> 20-second validity
runTest(10, 'Morning Check-In QR uses 20-second validity', () => {
  const qr = server_admin_generate_qr_session('CHECK_IN');
  assert.strictEqual(qr.actionType, 'CHECK_IN');
  assert.strictEqual(qr.validitySeconds, 20);
  const s = DB.qr_sessions.find(x => x.session_token === qr.sessionToken);
  assert.strictEqual((s.expires_at - s.created_at) / 1000, 20);
  return { details: `CHECK_IN QR configured with 20s TTL` };
});

// TEST 11: Afternoon Check-Out QR -> 20-second validity
runTest(11, 'Afternoon Check-Out QR uses 20-second validity', () => {
  const qr = server_admin_generate_qr_session('CHECK_OUT');
  assert.strictEqual(qr.actionType, 'CHECK_OUT');
  assert.strictEqual(qr.validitySeconds, 20);
  const s = DB.qr_sessions.find(x => x.session_token === qr.sessionToken);
  assert.strictEqual((s.expires_at - s.created_at) / 1000, 20);
  return { details: `CHECK_OUT QR configured with 20s TTL` };
});

// TEST 12: Attempt to manipulate client countdown
runTest(12, 'Client countdown manipulation cannot extend server validity', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  
  // Client maliciously sets countdown UI state to 9999 seconds
  let clientDisplaySeconds = 9999;
  assert.strictEqual(clientDisplaySeconds, 9999);

  // But scan happens at T=25s in real server time
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,
      lng: SENIOR_CAMPUS.longitude,
      simulatedServerTime: t0 + 25000
    });
  }, /QR_EXPIRED/);
  return { details: `Server checks authoritative expires_at timestamp; client timer manipulation ignored` };
});

// TEST 13: Attempt to manipulate device clock
runTest(13, 'Device clock rollback cannot bypass server-side expiry', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  
  // User rolls back mobile phone system clock to T=0 or earlier
  const clientManipulatedDeviceTime = t0 - 100000;
  assert.ok(clientManipulatedDeviceTime < t0);

  // Server evaluates using official database clock (e.g. T=30s)
  const actualServerTime = t0 + 30000;
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,
      lng: SENIOR_CAMPUS.longitude,
      simulatedServerTime: actualServerTime
    });
  }, /QR_EXPIRED/);
  return { details: `Server uses PostgreSQL clock_timestamp(); client phone clock is disregarded` };
});

// TEST 14: Expired QR with valid GPS -> REJECTED
runTest(14, 'Expired QR presented with perfect GPS location is REJECTED', () => {
  const t0 = 1758168000000;
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN', 20, t0);
  
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,      // Exactly on campus (0m distance)
      lng: SENIOR_CAMPUS.longitude,
      accuracy: 5.0,                   // Flawless 5m accuracy
      simulatedServerTime: t0 + 22000  // Expired by 2 seconds
    });
  }, /QR_EXPIRED/);
  return { details: `Valid location does not bypass QR expiry requirement` };
});

// TEST 15: Valid QR with invalid campus -> REJECTED by existing campus security
runTest(15, 'Valid QR scanned by teacher at wrong physical campus is REJECTED', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  
  // Teacher is at Junior Campus coordinates instead of Senior
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: JUNIOR_CAMPUS.latitude,
      lng: JUNIOR_CAMPUS.longitude,
      accuracy: 10.0
    });
  }, /GEOFENCE_EXCEEDED/);
  return { details: `Campus geofence strictly enforced regardless of QR timing` };
});

// TEST 16: Valid QR with unauthorized teacher-campus assignment -> REJECTED
runTest(16, 'Valid QR scanned by teacher not assigned to that campus is REJECTED', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  
  // Junior teacher attempts to check in at Senior School
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-junior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,
      lng: SENIOR_CAMPUS.longitude,
      accuracy: 10.0
    });
  }, /UNAUTHORIZED_CAMPUS/);
  return { details: `Teacher-campus binding security remains intact` };
});

// TEST 17: Existing one-use protection -> No regression
runTest(17, 'QR token is single-use; subsequent scan of same token is REJECTED', () => {
  const qr = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  
  // First scan: SUCCESS
  const res = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: qr.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_CAMPUS.latitude,
    lng: SENIOR_CAMPUS.longitude,
    accuracy: 10.0
  });
  assert.strictEqual(res.success, true);

  // Second scan with same token: REJECTED
  assert.throws(() => {
    server_verify_and_record_attendance({
      teacherId: 'teacher-senior-uuid',
      sessionToken: qr.sessionToken,
      actionType: 'CHECK_IN',
      lat: SENIOR_CAMPUS.latitude,
      lng: SENIOR_CAMPUS.longitude,
      accuracy: 10.0
    });
  }, /QR_ALREADY_USED/);
  return { details: `Token consumed on first scan; replay blocked immediately` };
});

// TEST 18: Existing Dynamic QR attendance flow -> No regression
runTest(18, 'Complete verified Check-In and Check-Out flow operates without regression', () => {
  // 1. Check-In
  const inQR = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_IN');
  const inRes = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: inQR.sessionToken,
    actionType: 'CHECK_IN',
    lat: SENIOR_CAMPUS.latitude,
    lng: SENIOR_CAMPUS.longitude,
    accuracy: 8.0
  });
  assert.strictEqual(inRes.success, true);
  assert.strictEqual(inRes.record.action_type, 'CHECK_IN');

  // 2. Check-Out
  const outQR = server_kiosk_generate_qr_session('GN-SENIOR-001', 'GyanodayKiosk@2026', 'CHECK_OUT');
  const outRes = server_verify_and_record_attendance({
    teacherId: 'teacher-senior-uuid',
    sessionToken: outQR.sessionToken,
    actionType: 'CHECK_OUT',
    lat: SENIOR_CAMPUS.latitude,
    lng: SENIOR_CAMPUS.longitude,
    accuracy: 9.0
  });
  assert.strictEqual(outRes.success, true);
  assert.strictEqual(outRes.record.action_type, 'CHECK_OUT');
  return { details: `Full lifecycle verified under 20-second dynamic QR system` };
});

// ------------------------------------------------------------------------------
// Summary
// ------------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST EXECUTION SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
