import { supabase } from '../lib/supabase';
import { formatStudentDisplayName, formatDisplayDate, buildAbsenteeParentMessage } from '../utils/studentUtils';
import { messageTemplateService } from './MessageTemplateService';

class AbsenteeNotificationService {
  /**
   * Format phone number to international format for India (+91)
   */
  formatPhoneNumber(phone) {
    return messageTemplateService.normalizePhoneNumber(phone);
  }

  /**
   * Helper to format student name from [LastName FirstName ...] to [FirstName ... LastName]
   * e.g., "Chettri Aarush" -> "Aarush Chettri"
   */
  formatDisplayName(name) {
    return formatStudentDisplayName(name);
  }

  /**
   * Helper to format date into DD-Mon-YYYY format
   */
  formatDisplayDate(date) {
    return formatDisplayDate(date);
  }

  /**
   * Generate personalized WhatsApp message link for a student's parent
   */
  generateParentWhatsAppUrl(student, className, dateStr, teacherName = '', customTemplate = null) {
    const message = this.generateParentMessageText(student, className, dateStr, teacherName, customTemplate);
    return messageTemplateService.generateWhatsAppUrl(student?.contact_number, message);
  }

  /**
   * Generate WhatsApp message text for a single parent using template service
   */
  generateParentMessageText(student, className, dateStr, teacherName = '', customTemplate = null) {
    return messageTemplateService.renderMessage('absentee_alert', {
      student_name: student?.name,
      class_name: className,
      roll_no: student?.roll_no,
      date: dateStr,
      teacher_name: teacherName
    }, customTemplate);
  }

  /**
   * Generate consolidated WhatsApp text for Principal
   */
  generatePrincipalSummaryUrl(principalPhone, absentStudents, className, dateStr, teacherName, customTemplate = null) {
    const summaryText = this.generateClassSummaryText(absentStudents, className, dateStr, teacherName, customTemplate);
    return messageTemplateService.generateWhatsAppUrl(principalPhone, summaryText);
  }

  /**
   * Generate class absentee summary text for broadcasting
   */
  generateClassSummaryText(absentStudents, className, dateStr, teacherName, customTemplate = null) {
    const classLabel = className ? (String(className).trim().toLowerCase().startsWith('class') ? className.trim() : `Class ${className.trim()}`) : 'Class N/A';
    const formattedDate = formatDisplayDate(dateStr);
    const studentList = absentStudents
      .map((s, idx) => {
        const displayName = formatStudentDisplayName(s.name);
        const rollLabel = s.roll_no ? (String(s.roll_no).toLowerCase().includes('roll') ? s.roll_no : `Roll No. ${s.roll_no}`) : 'Roll No. N/A';
        return `${idx + 1}. ${displayName} (${rollLabel}${s.contact_number ? `, Ph: ${s.contact_number}` : ''})`;
      })
      .join('\n');

    return messageTemplateService.renderMessage('daily_absence_summary', {
      class_name: classLabel,
      date: formattedDate,
      teacher_name: teacherName || 'Class Teacher',
      absent_count: absentStudents.length,
      absent_list: studentList,
      school_name: 'Gyanoday Niketan'
    }, customTemplate);
  }

  /**
   * Dispatches mobile push notifications to target device tokens
   */
  async sendMobilePush({ tokens, title, body, data = {} }) {
    if (!tokens || tokens.length === 0) return { success: false, reason: 'No tokens provided' };

    try {
      // 1. Invoke Supabase Edge Function 'send-notification'
      const { data: resData, error } = await supabase.functions.invoke('send-notification', {
        body: {
          tokens,
          notification: { title, body },
          data
        }
      });

      if (error) {
        console.warn('Edge function send-notification warning:', error);
      }
      return { success: !error, data: resData };
    } catch (err) {
      console.warn('Error invoking push notification service:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Trigger local device system notification if supported and granted
   */
  triggerLocalSystemNotification(title, body, linkUrl = '/') {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
              body,
              icon: '/logo.png',
              badge: '/logo.png',
              data: { linkUrl },
              vibrate: [200, 100, 200]
            });
          }).catch(() => {
            new Notification(title, { body, icon: '/logo.png', data: { linkUrl } });
          });
        } else {
          new Notification(title, { body, icon: '/logo.png', data: { linkUrl } });
        }
      }
    } catch (e) {
      console.warn('Local system notification error:', e);
    }
  }

  /**
   * Main Dispatch: Notify both Principal and Parents when attendance has absentees
   */
  async notifyAbsentees({
    absentStudents,
    className,
    classId,
    date,
    teacherName,
    teacherId,
    schoolId
  }) {
    if (!absentStudents || absentStudents.length === 0) {
      return { success: true, count: 0, message: 'No absentees to notify' };
    }

    const formattedDate = new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/ /g, '-');

    const result = {
      success: true,
      totalAbsent: absentStudents.length,
      date: formattedDate,
      className,
      teacherId,
      teacherName,
      principalNotified: false,
      principalProfiles: [],
      parentNotificationsCount: 0,
      studentAlerts: [],
      classSummaryText: this.generateClassSummaryText(absentStudents, className, formattedDate, teacherName)
    };

    try {
      // Avoid duplicate notifications if attendance is saved/finalized more than once today
      const todayDateStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];
      const todayStart = `${todayDateStr}T00:00:00.000Z`;
      const todayEnd = `${todayDateStr}T23:59:59.999Z`;

      const { data: existingTodayNotifs } = await supabase
        .from('notifications')
        .select('user_id, message')
        .eq('type', 'attendance_absent')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      const existingNotifs = existingTodayNotifs || [];

      // =========================================================================
      // 1. NOTIFY PRINCIPAL
      // =========================================================================
      const { data: principalProfiles, error: principalError } = await supabase
        .from('profiles')
        .select('id, name, role, designation, contact_number')
        .or('role.eq.principal,designation.ilike.%principal%,role.eq.admin');

      if (!principalError && principalProfiles && principalProfiles.length > 0) {
        result.principalProfiles = principalProfiles;
        const principalTitle = `🚨 Daily Absence Alert - Class ${className}`;
        const principalBody = `${absentStudents.length} student(s) marked absent in ${className} on ${formattedDate} by ${teacherName || 'Teacher'}: ${absentStudents.map(s => s.name).join(', ')}.`;
        const linkUrl = '/principal?tab=attendance';

        // Filter out principals who have already been notified for this class today
        const principalNotifsToInsert = principalProfiles
          .filter(p => !existingNotifs.some(en => en.user_id === p.id && en.message?.includes(`Class ${className}`)))
          .map(p => ({
            user_id: p.id,
            title: principalTitle,
            message: principalBody,
            type: 'attendance_absent',
            school_id: schoolId || null,
            is_read: false
          }));

        if (principalNotifsToInsert.length > 0) {
          const { error: insertNotifError } = await supabase
            .from('notifications')
            .insert(principalNotifsToInsert);

          if (!insertNotifError) {
            result.principalNotified = true;
          }
        } else {
          result.principalNotified = true;
          result.alreadyNotified = true;
        }

        // B. Query mobile push tokens for Principal(s)
        const principalIds = principalProfiles.map(p => p.id);
        const { data: principalDevices } = await supabase
          .from('user_devices')
          .select('fcm_token')
          .in('profile_id', principalIds)
          .neq('is_active', false);

        const principalTokens = (principalDevices || [])
          .map(d => d.fcm_token)
          .filter(Boolean);

        // Only send push if not already notified today
        if (principalTokens.length > 0 && principalNotifsToInsert.length > 0) {
          await this.sendMobilePush({
            tokens: principalTokens,
            title: principalTitle,
            body: principalBody,
            data: {
              linkUrl,
              type: 'attendance_absent',
              classId,
              date
            }
          });
        }

        // Trigger local notification if current user is admin/principal
        this.triggerLocalSystemNotification(principalTitle, principalBody, linkUrl);
      }

      // =========================================================================
      // 2. NOTIFY PARENTS
      // =========================================================================
      const studentIds = absentStudents.map(s => s.id);

      // Find any registered parent profiles mapped to these students
      const { data: parentMaps } = await supabase
        .from('parent_student_map')
        .select('parent_id, student_id')
        .in('student_id', studentIds);

      const parentMapByStudent = {};
      if (parentMaps) {
        parentMaps.forEach(pm => {
          if (!parentMapByStudent[pm.student_id]) parentMapByStudent[pm.student_id] = [];
          parentMapByStudent[pm.student_id].push(pm.parent_id);
        });
      }

      // Prepare In-App & Portal Notifications for Parents (filtered for duplicates)
      const parentInAppNotifs = [];
      const parentUserIds = [];

      absentStudents.forEach(student => {
        const displayName = this.formatDisplayName(student.name);
        const parentTitle = `Attendance Alert: ${displayName} Absent`;
        const parentBody = this.generateParentMessageText(student, className, formattedDate, teacherName);
        const mappedParents = parentMapByStudent[student.id] || [];

        mappedParents.forEach(parentId => {
          // Check if this parent was already notified for this student today
          const alreadyNotifiedParent = existingNotifs.some(en => en.user_id === parentId && (en.message?.includes(student.name) || en.message?.includes(displayName)));
          if (!alreadyNotifiedParent) {
            parentUserIds.push(parentId);
            parentInAppNotifs.push({
              user_id: parentId,
              title: parentTitle,
              message: parentBody,
              type: 'attendance_absent',
              school_id: schoolId || null,
              is_read: false
            });
          }
        });
      });

      if (parentInAppNotifs.length > 0) {
        const { error: parentNotifErr } = await supabase
          .from('notifications')
          .insert(parentInAppNotifs);

        if (!parentNotifErr) {
          result.parentNotificationsCount = parentInAppNotifs.length;
        }

        // Fetch parent device tokens for Mobile Push
        const { data: parentDevices } = await supabase
          .from('user_devices')
          .select('fcm_token, profile_id')
          .in('profile_id', parentUserIds)
          .neq('is_active', false);

        const parentTokens = (parentDevices || [])
          .map(d => d.fcm_token)
          .filter(Boolean);

        if (parentTokens.length > 0) {
          await this.sendMobilePush({
            tokens: parentTokens,
            title: `Attendance Alert: Absent Today`,
            body: `Your ward was marked absent on ${formattedDate} in Class ${className}.`,
            data: {
              linkUrl: '/parent-portal',
              type: 'attendance_absent'
            }
          });
        }
      }

      // Safe fallback attempt for student_notifications table (if it exists)
      try {
        const studentNotifs = absentStudents.map(student => ({
          student_id: student.id,
          attendance_date: date,
          title: 'Attendance Alert',
          message: `You were marked absent on ${formattedDate} in Class ${className}. Please contact the class teacher if this is incorrect.`,
          type: 'absence_alert',
          channel: 'portal'
        }));
        await supabase.from('student_notifications').upsert(studentNotifs, {
          onConflict: 'student_id,attendance_date,type'
        });
      } catch (e) {
        // Gracefully ignore if table does not exist
      }

      // Also try inserting into notifications table for direct student visibility
      try {
        const studentDirectNotifs = absentStudents.map(student => ({
          user_id: student.id,
          title: `🚨 Daily Absence Alert - Marked Absent`,
          message: `Dear ${this.formatDisplayName(student.name)}, you were marked ABSENT today (${formattedDate}) in Class ${className}. If this is an error, please contact your class teacher.`,
          type: 'attendance_absent',
          school_id: schoolId || null,
          is_read: false
        }));
        await supabase.from('notifications').insert(studentDirectNotifs);
      } catch (e) {
        // Gracefully ignore if RLS prevents
      }

      // =========================================================================
      // 3. PREPARE STUDENT ALERT OBJECTS WITH WHATSAPP DISPATCH
      // =========================================================================
      result.studentAlerts = absentStudents.map(student => ({
        ...student,
        formattedPhone: this.formatPhoneNumber(student.contact_number),
        whatsAppUrl: this.generateParentWhatsAppUrl(student, className, formattedDate),
        messageText: this.generateParentMessageText(student, className, formattedDate)
      }));

    } catch (err) {
      console.error('Error in AbsenteeNotificationService:', err);
      result.error = err.message || 'Error sending absentee notifications';
    }

    return result;
  }
}

export const absenteeNotificationService = new AbsenteeNotificationService();
export default absenteeNotificationService;
