import { supabase } from '../lib/supabase';

// Default Gyanoday Niketan Campus Coordinates (Darjeeling hills)
export const DEFAULT_SCHOOL_LOCATION = {
  latitude: 27.036007,
  longitude: 88.262672,
  allowed_radius_meters: 150,
  name: 'Gyanoday Niketan Main Campus'
};

export const DEFAULT_ATTENDANCE_WINDOWS = {
  check_in_start: '06:00',
  check_in_end: '12:00',
  check_out_start: '13:00',
  check_out_end: '19:00'
};

export const DEFAULT_QR_EXPIRY_SECONDS = 45;

/**
 * Haversine formula for distance in meters
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

/**
 * Browser Geolocation Wrapper with robust timeout and high accuracy
 */
export async function getCurrentDevicePosition() {
  if (!navigator || !navigator.geolocation) {
    throw new Error('LOCATION_NOT_SUPPORTED');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('LOCATION_PERMISSION_DENIED'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('LOCATION_UNAVAILABLE'));
            break;
          case err.TIMEOUT:
            reject(new Error('LOCATION_TIMEOUT'));
            break;
          default:
            reject(new Error('LOCATION_ERROR'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

/**
 * FAIL-CLOSED AUTHORITATIVE ATTENDANCE VERIFICATION SERVICE
 *
 * All verified attendance creation and state transitions MUST execute
 * through server-side PostgreSQL SECURITY DEFINER RPCs.
 * 
 * NO CLIENT-SIDE MUTATION FALLBACK IS PERMITTED.
 */
class AttendanceVerificationServiceImpl {
  /**
   * Fetch live school attendance configuration from school_settings
   */
  async getSettings() {
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('*')
        .in('setting_key', [
          'attendance_location',
          'attendance_windows',
          'attendance_qr_config',
          'staff_reporting_time',
          'staff_grace_period_mins'
        ]);

      let location = DEFAULT_SCHOOL_LOCATION;
      let windows = DEFAULT_ATTENDANCE_WINDOWS;
      let qrExpiry = DEFAULT_QR_EXPIRY_SECONDS;
      let reportingTime = '08:15';
      let graceMins = 10;

      if (data && data.length > 0) {
        data.forEach((s) => {
          try {
            if (s.setting_key === 'attendance_location') {
              location = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            }
            if (s.setting_key === 'attendance_windows') {
              windows = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            }
            if (s.setting_key === 'attendance_qr_config') {
              const conf = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
              qrExpiry = conf.expiry_seconds || DEFAULT_QR_EXPIRY_SECONDS;
            }
            if (s.setting_key === 'staff_reporting_time') {
              reportingTime = s.setting_value;
            }
            if (s.setting_key === 'staff_grace_period_mins') {
              graceMins = parseInt(s.setting_value, 10) || 10;
            }
          } catch (e) {
            console.warn(`Error parsing setting ${s.setting_key}:`, e);
          }
        });
      }

      return { location, windows, qrExpiry, reportingTime, graceMins };
    } catch (err) {
      console.warn('Failed to load settings from DB, using defaults:', err);
      return {
        location: DEFAULT_SCHOOL_LOCATION,
        windows: DEFAULT_ATTENDANCE_WINDOWS,
        qrExpiry: DEFAULT_QR_EXPIRY_SECONDS,
        reportingTime: '08:15',
        graceMins: 10
      };
    }
  }

  /**
   * Generate a dynamic, cryptographically random QR session for administrative display.
   * Authoritatively enforced by PostgreSQL RPC generate_attendance_qr_session.
   * Only authorized roles (admin, principal) can execute this RPC.
   */
  async generateQRSession(actionType = 'CHECK_IN', expirySeconds = DEFAULT_QR_EXPIRY_SECONDS) {
    const { data, error } = await supabase.rpc('generate_attendance_qr_session', {
      p_action_type: actionType,
      p_expiry_seconds: expirySeconds
    });

    if (error) {
      console.error('Server error generating attendance QR session:', error);
      throw new Error(error.message || 'UNAUTHORIZED_QR_GENERATION: Server rejected QR generation');
    }

    if (!data || !data.sessionToken) {
      throw new Error('FAILED_TO_GENERATE_QR: Empty session response from server');
    }

    const payloadObject = {
      prefix: 'GN-ATT',
      token: data.sessionToken,
      action: data.actionType || actionType,
      created_at: data.serverTime,
      expires_at: data.expiresAt
    };

    return {
      success: true,
      session: {
        id: data.sessionId,
        token: data.sessionToken,
        actionType: data.actionType || actionType,
        expiresAt: data.expiresAt,
        serverTime: data.serverTime,
        payloadString: JSON.stringify(payloadObject)
      }
    };
  }

  /**
   * Verify live QR session, location, and record teacher attendance via Atomic Server RPC.
   * 
   * SECURITY ENFORCEMENT:
   * - Server determines identity via auth.uid()
   * - Server determines official timestamp (NOW())
   * - Server verifies geofence distance against school settings
   * - Server enforces valid state transitions
   * - System FAILS CLOSED if RPC cannot execute. No client table insertion.
   */
  async verifyAndRecordAttendance({ sessionToken, actionType, latitude, longitude, deviceInfo }) {
    if (!sessionToken) {
      throw new Error('INVALID_QR_PAYLOAD: Missing session token in scanned code.');
    }

    // Call atomic PostgreSQL RPC
    const { data, error } = await supabase.rpc('verify_and_record_teacher_attendance', {
      p_session_token: sessionToken,
      p_action_type: actionType,
      p_lat: latitude != null ? Number(latitude) : null,
      p_lng: longitude != null ? Number(longitude) : null,
      p_device_info: deviceInfo || 'Teacher Mobile Browser (Verified QR)'
    });

    if (error) {
      const msg = error.message || '';
      console.error('Server RPC attendance verification rejected:', error);

      // Translate database exceptions into high-clarity error messages
      if (msg.includes('LOCATION_REQUIRED')) {
        throw new Error('GPS location is required to verify attendance on school campus. Please enable location permissions.');
      }
      if (msg.includes('GEOFENCE_EXCEEDED')) {
        throw new Error('Verification Failed: You are outside the school campus geofence. Please mark attendance inside school grounds.');
      }
      if (msg.includes('QR_EXPIRED')) {
        throw new Error('This QR code has expired. Please scan the current live QR on the school display.');
      }
      if (msg.includes('QR_ACTION_MISMATCH')) {
        throw new Error(`This QR code cannot be used for ${actionType === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}. Please scan the correct QR.`);
      }
      if (msg.includes('QR_ALREADY_USED')) {
        throw new Error('This QR token has already been consumed. Please scan the new live code.');
      }
      if (msg.includes('ALREADY_CHECKED_IN')) {
        throw new Error('You have already checked in for today.');
      }
      if (msg.includes('ALREADY_CHECKED_OUT')) {
        throw new Error('You have already checked out for today.');
      }
      if (msg.includes('NO_CHECK_IN_FOUND')) {
        throw new Error('Cannot check out without a valid morning check-in.');
      }
      if (msg.includes('CHECK_IN_WINDOW_CLOSED')) {
        throw new Error('Morning check-in window is currently closed.');
      }
      if (msg.includes('CHECK_OUT_WINDOW_CLOSED')) {
        throw new Error('Afternoon check-out window is not open yet or has closed.');
      }
      if (msg.includes('UNAUTHENTICATED')) {
        throw new Error('Session expired. Please log in again.');
      }
      if (msg.includes('ONLY_TEACHERS_PERMITTED')) {
        throw new Error('Unauthorized role. Only active teachers can mark teacher attendance.');
      }

      throw new Error(msg || 'Server verification failed. Please try again or request attendance correction.');
    }

    if (!data || !data.success) {
      throw new Error('Server returned an unsuccessful verification response.');
    }

    return {
      success: true,
      action: data.action,
      status: data.status,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      workingHours: data.workingHours,
      verificationStatus: data.verificationStatus,
      distanceMeters: data.distanceMeters,
      record: {
        id: data.recordId,
        status: data.status,
        check_in_time: data.checkInTime,
        check_out_time: data.checkOutTime,
        working_hours: data.workingHours,
        check_in_verification_status: data.verificationStatus,
        check_in_method: 'DYNAMIC_QR',
        check_in_distance_meters: data.distanceMeters
      }
    };
  }

  /**
   * Submit an official attendance correction request via server RPC.
   */
  async submitCorrectionRequest({ attendanceDate, requestType, requestedCheckInTime, requestedCheckOutTime, reason }) {
    if (!reason || reason.trim().length < 8) {
      throw new Error('REASON_REQUIRED: Please provide a detailed reason (at least 8 characters).');
    }

    let pReqType = 'CHECK_IN';
    if (requestType === 'CHECK_OUT_MISSED') pReqType = 'CHECK_OUT';
    else if (requestType === 'DUTY_TRAVEL' || requestType === 'LOCATION_ISSUE') pReqType = 'FULL_DAY';

    let requestedTimeIso = null;
    if (requestedCheckInTime) {
      requestedTimeIso = `${attendanceDate}T${requestedCheckInTime}:00+05:30`;
    }

    const { data, error } = await supabase.rpc('request_attendance_correction', {
      p_attendance_date: attendanceDate,
      p_request_type: pReqType,
      p_requested_time: requestedTimeIso,
      p_reason: reason.trim()
    });

    if (error) {
      console.error('request_attendance_correction RPC error:', error);
      throw new Error(error.message || 'Failed to submit correction request.');
    }

    return { success: true, requestId: data?.requestId };
  }

  /**
   * Coordinator/Principal review of an attendance correction request via server RPC.
   */
  async reviewCorrectionRequest({ requestId, decision, action, adminNotes, reviewNotes }) {
    const act = (action || decision || '').toUpperCase();
    if (act !== 'APPROVE' && act !== 'REJECT' && act !== 'APPROVED' && act !== 'REJECTED') {
      throw new Error('Invalid review action. Must be APPROVE or REJECT.');
    }

    const normalizedAction = act.startsWith('APPROV') ? 'APPROVE' : 'REJECT';

    const { data, error } = await supabase.rpc('review_attendance_correction', {
      p_request_id: requestId,
      p_action: normalizedAction,
      p_review_notes: (adminNotes || reviewNotes || '').trim() || null
    });

    if (error) {
      console.error('review_attendance_correction RPC error:', error);
      throw new Error(error.message || 'Failed to review correction request.');
    }

    return { success: true, status: normalizedAction === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
  }
}

export const AttendanceVerificationService = new AttendanceVerificationServiceImpl();
export const attendanceVerificationService = AttendanceVerificationService;
export default AttendanceVerificationService;
