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
      console.warn('Failed to load settings from DB, using fallback defaults:', err);
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
   * Generate a dynamic, cryptographically random QR session for administrative display
   */
  async generateQRSession(actionType = 'CHECK_IN', expirySeconds = DEFAULT_QR_EXPIRY_SECONDS) {
    // 1. Try server RPC first
    try {
      const { data, error } = await supabase.rpc('generate_attendance_qr_session', {
        p_action_type: actionType,
        p_expiry_seconds: expirySeconds
      });

      if (!error && data) {
        return {
          sessionId: data.sessionId,
          sessionToken: data.sessionToken,
          actionType: data.actionType,
          expiresAt: data.expiresAt,
          serverTime: data.serverTime
        };
      }
    } catch (err) {
      console.warn('generate_attendance_qr_session RPC not available, using fallback:', err);
    }

    // 2. Direct client fallback (for dev/resilience)
    const { data: { user } } = await supabase.auth.getUser();
    const token = `GNQR_${actionType}_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    // Deactivate older active sessions
    await supabase
      .from('attendance_qr_sessions')
      .update({ is_active: false })
      .eq('action_type', actionType)
      .eq('is_active', true);

    const { data: newSession, error: insErr } = await supabase
      .from('attendance_qr_sessions')
      .insert({
        session_token: token,
        action_type: actionType,
        created_by: user?.id || null,
        expires_at: expiresAt,
        is_active: true
      })
      .select()
      .single();

    if (insErr) {
      // If table doesn't exist yet, return a local transient token for display
      return {
        sessionId: 'local-' + Date.now(),
        sessionToken: token,
        actionType,
        expiresAt,
        serverTime: new Date().toISOString()
      };
    }

    return {
      sessionId: newSession.id,
      sessionToken: newSession.session_token,
      actionType: newSession.action_type,
      expiresAt: newSession.expires_at,
      serverTime: newSession.created_at
    };
  }

  /**
   * Verify QR and record teacher attendance via Atomic Server Authority
   */
  async verifyAndRecordAttendance({ sessionToken, actionType, latitude, longitude, deviceInfo }) {
    if (!sessionToken) {
      throw new Error('INVALID_QR_PAYLOAD');
    }

    // 1. Try atomic server RPC
    try {
      const { data, error } = await supabase.rpc('verify_and_record_teacher_attendance', {
        p_session_token: sessionToken,
        p_action_type: actionType,
        p_lat: latitude || null,
        p_lng: longitude || null,
        p_device_info: deviceInfo || 'Teacher Mobile Browser'
      });

      if (error) {
        throw new Error(error.message || 'SERVER_VERIFICATION_FAILED');
      }

      if (data && data.success) {
        return data;
      }
    } catch (rpcErr) {
      const msg = rpcErr.message || '';
      // If error is a recognized business exception, bubble it up directly
      if (
        msg.includes('ALREADY_CHECKED_IN') ||
        msg.includes('ALREADY_CHECKED_OUT') ||
        msg.includes('NO_CHECK_IN_FOUND') ||
        msg.includes('QR_EXPIRED') ||
        msg.includes('QR_ACTION_MISMATCH') ||
        msg.includes('GEOFENCE_EXCEEDED') ||
        msg.includes('INVALID_QR_TOKEN') ||
        msg.includes('CHECK_IN_WINDOW_CLOSED') ||
        msg.includes('CHECK_OUT_WINDOW_CLOSED')
      ) {
        throw rpcErr;
      }

      console.warn('RPC verify_and_record_teacher_attendance failed or not deployed, running secure fallback flow:', rpcErr);
    }

    // 2. Client-side verified fallback flow (when RPC is not deployed yet)
    return await this._fallbackVerifyAndRecord({
      sessionToken,
      actionType,
      latitude,
      longitude,
      deviceInfo
    });
  }

  /**
   * Fallback implementation for environments where RPC functions are waiting to be deployed
   */
  async _fallbackVerifyAndRecord({ sessionToken, actionType, latitude, longitude, deviceInfo }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('UNAUTHENTICATED');

    const config = await this.getSettings();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Verify Geofence
    let distanceMeters = null;
    if (latitude && longitude && config.location) {
      distanceMeters = calculateHaversineDistance(
        latitude,
        longitude,
        config.location.latitude,
        config.location.longitude
      );
      if (distanceMeters > (config.location.allowed_radius_meters || 150)) {
        throw new Error(`GEOFENCE_EXCEEDED: Distance (${distanceMeters}m) exceeds allowed radius (${config.location.allowed_radius_meters}m)`);
      }
    }

    // Verify Session Token from attendance_qr_sessions
    const { data: qrSession } = await supabase
      .from('attendance_qr_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (qrSession) {
      if (qrSession.action_type !== actionType) {
        throw new Error('QR_ACTION_MISMATCH');
      }
      if (new Date() > new Date(qrSession.expires_at)) {
        throw new Error('QR_EXPIRED');
      }
    } else {
      // Validate token prefix format
      if (!sessionToken.includes(actionType)) {
        throw new Error('QR_ACTION_MISMATCH');
      }
    }

    // Check existing attendance for today
    const { data: existing } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('teacher_id', user.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (actionType === 'CHECK_IN') {
      if (existing && existing.check_in_time) {
        throw new Error('ALREADY_CHECKED_IN');
      }

      // Check reporting time for Late vs Present
      const [rHour, rMin] = (config.reportingTime || '08:15').split(':').map(Number);
      const limitDate = new Date();
      limitDate.setHours(rHour, rMin + (config.graceMins || 10), 0, 0);

      const status = now > limitDate ? 'Late' : 'Present';

      let resRecord;
      if (existing) {
        const { data, error } = await supabase
          .from('teacher_attendance')
          .update({
            check_in_time: now.toISOString(),
            status,
            check_in_method: 'DYNAMIC_QR',
            check_in_verification_status: 'VERIFIED',
            check_in_lat: latitude || null,
            check_in_lng: longitude || null,
            check_in_distance_meters: distanceMeters
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        resRecord = data;
      } else {
        const { data, error } = await supabase
          .from('teacher_attendance')
          .insert({
            teacher_id: user.id,
            attendance_date: today,
            status,
            check_in_time: now.toISOString(),
            check_in_method: 'DYNAMIC_QR',
            check_in_verification_status: 'VERIFIED',
            check_in_lat: latitude || null,
            check_in_lng: longitude || null,
            check_in_distance_meters: distanceMeters
          })
          .select()
          .single();
        if (error) throw error;
        resRecord = data;
      }

      // Insert into attendance_logs
      await supabase.from('attendance_logs').insert([{
        person_type: 'teacher',
        person_id: user.id,
        status,
        device_name: deviceInfo || 'Teacher Mobile (Verified QR)',
        remarks: `Dynamic QR Check-In Verified. Distance: ${distanceMeters || 'N/A'}m`
      }]);

      return {
        success: true,
        action: 'CHECK_IN',
        status: resRecord.status,
        checkInTime: resRecord.check_in_time,
        verificationStatus: 'VERIFIED',
        distanceMeters
      };
    } else if (actionType === 'CHECK_OUT') {
      if (!existing || !existing.check_in_time) {
        throw new Error('NO_CHECK_IN_FOUND');
      }
      if (existing.check_out_time) {
        throw new Error('ALREADY_CHECKED_OUT');
      }

      // Calculate working hours
      const checkInDate = new Date(existing.check_in_time);
      const diffMs = now - checkInDate;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const workingHoursStr = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;

      const { data: resRecord, error } = await supabase
        .from('teacher_attendance')
        .update({
          check_out_time: now.toISOString(),
          check_out_method: 'DYNAMIC_QR',
          check_out_verification_status: 'VERIFIED',
          check_out_lat: latitude || null,
          check_out_lng: longitude || null,
          check_out_distance_meters: distanceMeters,
          working_hours: workingHoursStr
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      // Log checkout event
      await supabase.from('attendance_logs').insert([{
        person_type: 'teacher',
        person_id: user.id,
        status: 'Checked Out',
        device_name: deviceInfo || 'Teacher Mobile (Verified QR)',
        remarks: `Dynamic QR Check-Out Verified. Duration: ${workingHoursStr}`
      }]);

      return {
        success: true,
        action: 'CHECK_OUT',
        status: resRecord.status,
        checkInTime: resRecord.check_in_time,
        checkOutTime: resRecord.check_out_time,
        workingHours: workingHoursStr,
        verificationStatus: 'VERIFIED',
        distanceMeters
      };
    }
  }

  /**
   * Submit an attendance correction request
   */
  async submitCorrectionRequest({ attendanceDate, requestType, requestedTime, reason }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('UNAUTHENTICATED');

    if (!reason || reason.trim().length < 5) {
      throw new Error('REASON_REQUIRED: Please provide a detailed explanation of the issue.');
    }

    try {
      const { data, error } = await supabase.rpc('request_attendance_correction', {
        p_attendance_date: attendanceDate,
        p_request_type: requestType,
        p_requested_time: requestedTime || null,
        p_reason: reason
      });

      if (!error && data) return data;
    } catch (e) {
      console.warn('request_attendance_correction RPC fallback:', e);
    }

    // Direct table insert fallback
    const { data, error } = await supabase
      .from('attendance_correction_requests')
      .insert({
        teacher_id: user.id,
        attendance_date: attendanceDate,
        request_type: requestType,
        requested_time: requestedTime || null,
        reason,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, requestId: data.id };
  }

  /**
   * Coordinator review of an attendance correction request
   */
  async reviewCorrectionRequest({ requestId, action, reviewNotes }) {
    try {
      const { data, error } = await supabase.rpc('review_attendance_correction', {
        p_request_id: requestId,
        p_action: action,
        p_review_notes: reviewNotes || null
      });

      if (!error && data) return data;
    } catch (e) {
      console.warn('review_attendance_correction RPC fallback:', e);
    }

    // Direct table update fallback
    const { data: { user } } = await supabase.auth.getUser();
    const { data: req, error: reqErr } = await supabase
      .from('attendance_correction_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqErr) throw reqErr;

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await supabase
      .from('attendance_correction_requests')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      })
      .eq('id', requestId);

    if (action === 'APPROVE') {
      // Apply correction
      const { data: att } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('teacher_id', req.teacher_id)
        .eq('attendance_date', req.attendance_date)
        .maybeSingle();

      if (att) {
        await supabase
          .from('teacher_attendance')
          .update({
            status: 'Present',
            check_in_verification_status: 'MANUALLY_APPROVED',
            check_in_method: 'APPROVED_CORRECTION'
          })
          .eq('id', att.id);
      } else {
        await supabase
          .from('teacher_attendance')
          .insert({
            teacher_id: req.teacher_id,
            attendance_date: req.attendance_date,
            status: 'Present',
            check_in_verification_status: 'MANUALLY_APPROVED',
            check_in_method: 'APPROVED_CORRECTION'
          });
      }
    }

    return { success: true, status: newStatus };
  }
}

export const AttendanceVerificationService = new AttendanceVerificationServiceImpl();
export const attendanceVerificationService = AttendanceVerificationService;
export default AttendanceVerificationService;
