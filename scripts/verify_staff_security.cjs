/**
 * Automated Security Audit & Regression Verification Suite
 * Phase 1 Production Hardening for Non-Teaching & Group D Staff Portal
 */

const assert = require('assert');

// -------------------------------------------------------------
// 1. Geolocation & Haversine Distance Calculation Model
// -------------------------------------------------------------
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// -------------------------------------------------------------
// 2. Attendance RPC Mock Simulator implementing exact SQL logic
// -------------------------------------------------------------
function simulateAttendanceRPC({
  authUid,
  userProfile,
  sessionToken,
  actionType,
  lat,
  lng,
  accuracy,
  qrSessions,
  existingRecord,
  userCampusAssignments,
  campus
}) {
  // 1. Check Authentication
  if (!authUid) {
    throw new Error('UNAUTHENTICATED: Please log in to mark attendance.');
  }

  // 2. Role Check
  const validRoles = [
    'teacher', 'admin', 'principal', 'coordinator', 'accountant', 'librarian', 'non_teaching', 'group_d', 'staff'
  ];
  if (!userProfile || !validRoles.includes(userProfile.role)) {
    throw new Error('UNAUTHORIZED_ROLE: Only authorized faculty and staff members can record attendance.');
  }

  // 3. Action type check
  if (!['CHECK_IN', 'CHECK_OUT'].includes(actionType)) {
    throw new Error('INVALID_ACTION_TYPE: Must be CHECK_IN or CHECK_OUT.');
  }

  // 4. QR Token Validation
  const session = qrSessions.find(s => s.session_token === sessionToken);
  if (!session) {
    throw new Error('INVALID_QR_TOKEN: The scanned QR token is invalid or does not exist.');
  }

  if (session.action_type !== actionType) {
    throw new Error(`QR_ACTION_MISMATCH: Scanned code is for ${session.action_type} but requested ${actionType}.`);
  }

  if (session.is_active === false) {
    throw new Error('QR_ALREADY_USED: This QR token has already been consumed. Please scan the new live code.');
  }

  const now = new Date();
  if (now > new Date(session.expires_at)) {
    throw new Error('QR_EXPIRED: Attendance QR code has expired. Please scan the newly generated code.');
  }

  // 5. Cross-Campus Roaming Check
  if (!['admin', 'principal'].includes(userProfile.role)) {
    const assignments = userCampusAssignments.filter(a => a.teacher_id === authUid && a.active);
    if (assignments.length > 0) {
      const match = assignments.find(a => a.campus_id === campus.id);
      if (!match) {
        throw new Error(`UNAUTHORIZED_CAMPUS: You are not authorized to mark attendance at ${campus.campus_name}.`);
      }
    }
  }

  // 6. Geolocation & Accuracy
  if (lat == null || lng == null) {
    throw new Error('LOCATION_REQUIRED: GPS coordinates are required for attendance verification.');
  }

  const maxAccuracy = campus.max_gps_accuracy_meters || 50.0;
  if (accuracy != null && accuracy > maxAccuracy) {
    throw new Error(`GPS_ACCURACY_INSUFFICIENT: GPS accuracy of ${accuracy}m is too poor (must be within ${maxAccuracy}m).`);
  }

  const distanceMeters = calculateHaversineDistance(lat, lng, campus.latitude, campus.longitude);
  if (distanceMeters > campus.geofence_radius_meters) {
    throw new Error(`GEOFENCE_EXCEEDED: You are ${Math.round(distanceMeters)}m from ${campus.campus_name} (allowed: ${campus.geofence_radius_meters}m).`);
  }

  // 7. State Machine
  if (actionType === 'CHECK_IN') {
    if (existingRecord && existingRecord.check_in_time) {
      throw new Error('ALREADY_CHECKED_IN');
    }
    return {
      success: true,
      action: 'CHECK_IN',
      status: 'Present',
      teacher_id: authUid, // strictly bound to authUid
      distanceMeters: Math.round(distanceMeters)
    };
  } else if (actionType === 'CHECK_OUT') {
    if (!existingRecord || !existingRecord.check_in_time) {
      throw new Error('NO_CHECK_IN_FOUND');
    }
    if (existingRecord.check_out_time) {
      throw new Error('ALREADY_CHECKED_OUT');
    }
    return {
      success: true,
      action: 'CHECK_OUT',
      teacher_id: authUid,
      distanceMeters: Math.round(distanceMeters)
    };
  }
}

// -------------------------------------------------------------
// 3. RLS Policies Simulation
// -------------------------------------------------------------
function simulateTeacherAttendanceRLS({ action, authUser, targetRecord, newRow }) {
  const isManagement = ['admin', 'principal', 'coordinator'].includes(authUser?.role);

  if (action === 'SELECT') {
    // USING (teacher_id = auth.uid() OR isManagement)
    if (targetRecord.teacher_id === authUser.id || isManagement) {
      return { allowed: true };
    }
    return { allowed: false, error: 'RLS: Row filtered out (unauthorized SELECT)' };
  }

  if (['INSERT', 'UPDATE', 'DELETE'].includes(action)) {
    // Only management can directly mutate outside the verified RPC
    if (isManagement) {
      return { allowed: true };
    }
    return { allowed: false, error: '42501: new row violates row-level security policy for table "teacher_attendance"' };
  }
}

function simulateCorrectionRequestRLS({ action, authUser, newRow }) {
  const isManagement = ['admin', 'principal'].includes(authUser?.role);

  if (action === 'INSERT') {
    // WITH CHECK (teacher_id = auth.uid() AND (status IS NULL OR status = 'PENDING'))
    if (newRow.teacher_id !== authUser.id) {
      return { allowed: false, error: 'Cannot insert request for another user' };
    }
    if (newRow.status && newRow.status !== 'PENDING') {
      return { allowed: false, error: 'Cannot self-approve correction requests' };
    }
    return { allowed: true };
  }

  if (action === 'UPDATE') {
    if (isManagement) return { allowed: true };
    return { allowed: false, error: '42501: Only management can review correction requests' };
  }
}

// -------------------------------------------------------------
// 4. Notice Targeting Resolution
// -------------------------------------------------------------
function resolveNoticeAudienceFilter(role, assignedClassIds = []) {
  let audienceFilter = ['all', 'staff'];
  if (role === 'group_d') {
    audienceFilter.push('group_d');
  } else if (['non_teaching', 'accountant', 'librarian'].includes(role)) {
    audienceFilter.push('non_teaching');
  } else if (role === 'teacher' || role === 'admin' || role === 'principal' || role === 'coordinator') {
    audienceFilter.push('teachers');
    if (assignedClassIds && assignedClassIds.length > 0) {
      assignedClassIds.forEach(cid => audienceFilter.push(`class:${cid}`));
    }
  } else if (role === 'student') {
    return ['all', 'students', ...assignedClassIds.map(cid => `class:${cid}`)];
  }
  return audienceFilter;
}

function doesUserReceiveNotice(userRole, assignedClassIds, noticeAudience) {
  const filter = resolveNoticeAudienceFilter(userRole, assignedClassIds);
  return filter.includes(noticeAudience);
}

// -------------------------------------------------------------
// 5. Route Guarding Resolution
// -------------------------------------------------------------
function checkAcademicRouteAccess(profile) {
  if (!profile) return { redirect: '/login' };
  const isPureSupportStaff = ['non_teaching', 'group_d', 'staff', 'accountant', 'librarian'].includes(profile.role);
  if (isPureSupportStaff) return { redirect: '/dashboard' };
  return { allowed: true };
}

function checkTeacherRouteAccess(profile) {
  if (!profile) return { redirect: '/dashboard' };
  const isTeachingPrincipal = profile.role === 'principal';
  if (profile.role !== 'teacher' && profile.role !== 'admin' && !isTeachingPrincipal) {
    return { redirect: '/dashboard' };
  }
  return { allowed: true };
}

// =============================================================
// RUN TESTS
// =============================================================
console.log('=============================================================');
console.log('RUNNING PHASE 1 SECURITY AUDIT & REGRESSION TEST SUITE');
console.log('=============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

// Test Campus Setup
const mainCampus = {
  id: 'campus-1',
  campus_id: 'SENIOR_SCHOOL',
  campus_name: 'Senior School',
  latitude: 27.039,
  longitude: 88.263,
  geofence_radius_meters: 150.0,
  max_gps_accuracy_meters: 50.0
};

const secondCampus = {
  id: 'campus-2',
  campus_id: 'JUNIOR_SCHOOL',
  campus_name: 'Junior School',
  latitude: 27.050,
  longitude: 88.270,
  geofence_radius_meters: 150.0,
  max_gps_accuracy_meters: 50.0
};

const validToken = {
  session_token: 'valid-in-token-123',
  action_type: 'CHECK_IN',
  is_active: true,
  expires_at: new Date(Date.now() + 15000).toISOString() // expires in 15s
};

const expiredToken = {
  session_token: 'expired-token-456',
  action_type: 'CHECK_IN',
  is_active: true,
  expires_at: new Date(Date.now() - 5000).toISOString() // expired 5s ago
};

const consumedToken = {
  session_token: 'consumed-token-789',
  action_type: 'CHECK_IN',
  is_active: false,
  expires_at: new Date(Date.now() + 15000).toISOString()
};

// -------------------------------------------------------------
// SECTION 1: ATTENDANCE SECURITY CONTROLS
// -------------------------------------------------------------
console.log('--- 1. Attendance Security & Failure Testing ---');

runTest('1.1 Support staff (group_d) can check in successfully with valid QR + GPS', () => {
  const res = simulateAttendanceRPC({
    authUid: 'group-d-user-1',
    userProfile: { id: 'group-d-user-1', role: 'group_d', designation: 'Security Guard' },
    sessionToken: 'valid-in-token-123',
    actionType: 'CHECK_IN',
    lat: 27.03901,
    lng: 88.26301,
    accuracy: 10.0,
    qrSessions: [validToken],
    existingRecord: null,
    userCampusAssignments: [],
    campus: mainCampus
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.teacher_id, 'group-d-user-1');
});

runTest('1.2 Support staff (non_teaching) can check in successfully', () => {
  const res = simulateAttendanceRPC({
    authUid: 'nt-user-1',
    userProfile: { id: 'nt-user-1', role: 'non_teaching', designation: 'Office Assistant' },
    sessionToken: 'valid-in-token-123',
    actionType: 'CHECK_IN',
    lat: 27.03901,
    lng: 88.26301,
    accuracy: 12.0,
    qrSessions: [validToken],
    existingRecord: null,
    userCampusAssignments: [],
    campus: mainCampus
  });
  assert.strictEqual(res.success, true);
});

runTest('1.3 Expired QR token (>20s) must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'expired-token-456',
      actionType: 'CHECK_IN',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [expiredToken],
      existingRecord: null,
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /QR_EXPIRED/);
});

runTest('1.4 Invalid QR token must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'non-existent-token',
      actionType: 'CHECK_IN',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [validToken],
      existingRecord: null,
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /INVALID_QR_TOKEN/);
});

runTest('1.5 Consumed / already used QR token must be rejected (one-time use)', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'consumed-token-789',
      actionType: 'CHECK_IN',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [consumedToken],
      existingRecord: null,
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /QR_ALREADY_USED/);
});

runTest('1.6 Action type mismatch (scanning Check-In QR for Check-Out) must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'valid-in-token-123',
      actionType: 'CHECK_OUT', // mismatch!
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [validToken],
      existingRecord: { check_in_time: new Date() },
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /QR_ACTION_MISMATCH/);
});

runTest('1.7 QR from unauthorized campus must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'valid-in-token-123',
      actionType: 'CHECK_IN',
      lat: 27.05001,
      lng: 88.27001,
      accuracy: 10.0,
      qrSessions: [validToken],
      existingRecord: null,
      userCampusAssignments: [
        { teacher_id: 'group-d-user-1', campus_id: 'campus-1', active: true } // Assigned to Senior School only
      ],
      campus: secondCampus // Scanning at Junior School
    });
  }, /UNAUTHORIZED_CAMPUS/);
});

runTest('1.8 GPS coordinates outside campus geofence (>150m) must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'valid-in-token-123',
      actionType: 'CHECK_IN',
      lat: 27.045, // ~600m away
      lng: 88.263,
      accuracy: 10.0,
      qrSessions: [validToken],
      existingRecord: null,
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /GEOFENCE_EXCEEDED/);
});

runTest('1.9 Poor GPS accuracy (>50m) must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'valid-in-token-123',
      actionType: 'CHECK_IN',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 95.0, // poor fix
      qrSessions: [validToken],
      existingRecord: null,
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /GPS_ACCURACY_INSUFFICIENT/);
});

runTest('1.10 Duplicate check-in on the same day must be rejected', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'valid-in-token-123',
      actionType: 'CHECK_IN',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [validToken],
      existingRecord: { id: 'rec-1', check_in_time: new Date() }, // Already checked in
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /ALREADY_CHECKED_IN/);
});

runTest('1.11 Check-out without prior check-in must be rejected', () => {
  const checkoutToken = {
    session_token: 'valid-out-token-999',
    action_type: 'CHECK_OUT',
    is_active: true,
    expires_at: new Date(Date.now() + 15000).toISOString()
  };
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'group-d-user-1',
      userProfile: { id: 'group-d-user-1', role: 'group_d' },
      sessionToken: 'valid-out-token-999',
      actionType: 'CHECK_OUT',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [checkoutToken],
      existingRecord: null, // No check-in record!
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /NO_CHECK_IN_FOUND/);
});

runTest('1.12 Unauthorized role (e.g. student) cannot mark staff attendance', () => {
  assert.throws(() => {
    simulateAttendanceRPC({
      authUid: 'student-user-1',
      userProfile: { id: 'student-user-1', role: 'student' },
      sessionToken: 'valid-in-token-123',
      actionType: 'CHECK_IN',
      lat: 27.03901,
      lng: 88.26301,
      accuracy: 10.0,
      qrSessions: [validToken],
      existingRecord: null,
      userCampusAssignments: [],
      campus: mainCampus
    });
  }, /UNAUTHORIZED_ROLE/);
});

// -------------------------------------------------------------
// SECTION 2: RLS POLICY AUDIT & DIRECT MUTATION BLOCKING
// -------------------------------------------------------------
console.log('\n--- 2. RLS Policies & Direct Mutation Hardening ---');

runTest('2.1 Staff user attempting direct table INSERT on teacher_attendance is blocked by RLS', () => {
  const res = simulateTeacherAttendanceRLS({
    action: 'INSERT',
    authUser: { id: 'group-d-user-1', role: 'group_d' },
    newRow: { teacher_id: 'group-d-user-1', status: 'Present' }
  });
  assert.strictEqual(res.allowed, false);
  assert.match(res.error, /violates row-level security policy/);
});

runTest('2.2 Staff user attempting direct table UPDATE on teacher_attendance is blocked by RLS', () => {
  const res = simulateTeacherAttendanceRLS({
    action: 'UPDATE',
    authUser: { id: 'nt-user-1', role: 'non_teaching' },
    targetRecord: { id: 'rec-1', teacher_id: 'nt-user-1' }
  });
  assert.strictEqual(res.allowed, false);
});

runTest('2.3 Leadership (Admin/Principal/Coordinator) can modify teacher_attendance directly', () => {
  const res = simulateTeacherAttendanceRLS({
    action: 'UPDATE',
    authUser: { id: 'admin-user', role: 'admin' },
    targetRecord: { id: 'rec-1', teacher_id: 'nt-user-1' }
  });
  assert.strictEqual(res.allowed, true);
});

runTest('2.4 Staff user can ONLY view their own attendance records (cross-user read blocked)', () => {
  const ownRead = simulateTeacherAttendanceRLS({
    action: 'SELECT',
    authUser: { id: 'group-d-user-1', role: 'group_d' },
    targetRecord: { id: 'rec-1', teacher_id: 'group-d-user-1' }
  });
  assert.strictEqual(ownRead.allowed, true);

  const otherRead = simulateTeacherAttendanceRLS({
    action: 'SELECT',
    authUser: { id: 'group-d-user-1', role: 'group_d' },
    targetRecord: { id: 'rec-2', teacher_id: 'other-user-9' }
  });
  assert.strictEqual(otherRead.allowed, false);
});

runTest('2.5 Staff cannot insert pre-approved correction requests', () => {
  const tamperedRequest = simulateCorrectionRequestRLS({
    action: 'INSERT',
    authUser: { id: 'group-d-user-1', role: 'group_d' },
    newRow: { teacher_id: 'group-d-user-1', status: 'APPROVED' } // Tamper attempt!
  });
  assert.strictEqual(tamperedRequest.allowed, false);
});

runTest('2.6 Staff can submit genuine PENDING correction requests for themselves', () => {
  const validRequest = simulateCorrectionRequestRLS({
    action: 'INSERT',
    authUser: { id: 'group-d-user-1', role: 'group_d' },
    newRow: { teacher_id: 'group-d-user-1', status: 'PENDING', reason: 'Forgot morning scan' }
  });
  assert.strictEqual(validRequest.allowed, true);
});

// -------------------------------------------------------------
// SECTION 3: NOTICE TARGETING MATRIX
// -------------------------------------------------------------
console.log('\n--- 3. Notice Audience Targeting Verification ---');

const testAudiences = ['all', 'staff', 'teachers', 'non_teaching', 'group_d', 'students', 'class:cls-6a'];

runTest('3.1 Group D staff receives ONLY [all, staff, group_d]', () => {
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'all'), true);
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'staff'), true);
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'group_d'), true);
  // Must NOT receive
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'teachers'), false);
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'non_teaching'), false);
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'students'), false);
  assert.strictEqual(doesUserReceiveNotice('group_d', [], 'class:cls-6a'), false);
});

runTest('3.2 Non-Teaching staff receives ONLY [all, staff, non_teaching]', () => {
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'all'), true);
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'staff'), true);
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'non_teaching'), true);
  // Must NOT receive
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'group_d'), false);
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'teachers'), false);
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'students'), false);
  assert.strictEqual(doesUserReceiveNotice('non_teaching', [], 'class:cls-6a'), false);
});

runTest('3.3 Teachers receive ONLY [all, staff, teachers, assigned classes]', () => {
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'all'), true);
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'staff'), true);
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'teachers'), true);
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'class:cls-6a'), true);
  // Must NOT receive
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'non_teaching'), false);
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'group_d'), false);
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'students'), false);
  assert.strictEqual(doesUserReceiveNotice('teacher', ['cls-6a'], 'class:cls-7b'), false);
});

runTest('3.4 Students receive ONLY [all, students, own class]', () => {
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'all'), true);
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'students'), true);
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'class:cls-6a'), true);
  // Must NOT receive
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'staff'), false);
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'teachers'), false);
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'non_teaching'), false);
  assert.strictEqual(doesUserReceiveNotice('student', ['cls-6a'], 'group_d'), false);
});

// -------------------------------------------------------------
// SECTION 4: ROUTE GUARDS & REGRESSION SAFETY
// -------------------------------------------------------------
console.log('\n--- 4. Route Guards & Role Regression Testing ---');

runTest('4.1 Support staff cannot access AcademicRoute (/study-materials, /assignments)', () => {
  assert.strictEqual(checkAcademicRouteAccess({ role: 'group_d' }).redirect, '/dashboard');
  assert.strictEqual(checkAcademicRouteAccess({ role: 'non_teaching' }).redirect, '/dashboard');
  assert.strictEqual(checkAcademicRouteAccess({ role: 'accountant' }).redirect, '/dashboard');
  assert.strictEqual(checkAcademicRouteAccess({ role: 'librarian' }).redirect, '/dashboard');
  assert.strictEqual(checkAcademicRouteAccess({ role: 'staff' }).redirect, '/dashboard');
});

runTest('4.2 Teachers, Students, Admins CAN access AcademicRoute', () => {
  assert.strictEqual(checkAcademicRouteAccess({ role: 'teacher' }).allowed, true);
  assert.strictEqual(checkAcademicRouteAccess({ role: 'student' }).allowed, true);
  assert.strictEqual(checkAcademicRouteAccess({ role: 'admin' }).allowed, true);
  assert.strictEqual(checkAcademicRouteAccess({ role: 'principal' }).allowed, true);
});

runTest('4.3 Support staff cannot access TeacherRoute (/classes, /attendance, /hub)', () => {
  assert.strictEqual(checkTeacherRouteAccess({ role: 'group_d' }).redirect, '/dashboard');
  assert.strictEqual(checkTeacherRouteAccess({ role: 'non_teaching' }).redirect, '/dashboard');
});

runTest('4.4 Teachers and Admins CAN access TeacherRoute', () => {
  assert.strictEqual(checkTeacherRouteAccess({ role: 'teacher' }).allowed, true);
  assert.strictEqual(checkTeacherRouteAccess({ role: 'admin' }).allowed, true);
});

console.log('\n=============================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('=============================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
