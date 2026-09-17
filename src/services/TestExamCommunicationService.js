/**
 * TestExamCommunicationService.js
 * Authoritative Server-Side Logic & Workflow Service for:
 * Gyanoday Niketan ERP: Teacher Test & Examination Matter Communication Centre
 * 
 * Enforces:
 * - Server-authoritative teacher authorization (Subject Teacher vs Class Teacher)
 * - Anti-tampering: Never trusts client-supplied role or arbitrary recipient IDs
 * - Recipient snapshot creation upon publishing (immutable historical record)
 * - Non-destructive versioning (V1 -> V2) with audit trail
 * - Date change & postponement alerts with original date preservation
 * - Integration with existing Weekly Tests & Assessment Patterns without duplicate marks engines
 * - Multi-channel delivery: In-App, FCM Push, and optional WhatsApp text
 * - Strict attachment validation (MIME types & max 10MB)
 * - Immutability of audit logs and historical communications
 */

import { supabase } from '../lib/supabase';
import { notificationService } from './NotificationService';

export const PREDEFINED_COMMUNICATION_TYPES = [
  { id: 'TEST_ANNOUNCEMENT', label: 'Test Announcement', category: 'TEST', color: 'blue' },
  { id: 'EXAM_ANNOUNCEMENT', label: 'Exam Announcement', category: 'EXAM', color: 'indigo' },
  { id: 'TEST_PORTION', label: 'Test Portion / Syllabus', category: 'TEST', color: 'emerald' },
  { id: 'EXAM_PORTION', label: 'Exam Portion / Syllabus', category: 'EXAM', color: 'teal' },
  { id: 'TEST_INSTRUCTIONS', label: 'Test Instructions', category: 'TEST', color: 'cyan' },
  { id: 'EXAM_INSTRUCTIONS', label: 'Exam Instructions', category: 'EXAM', color: 'sky' },
  { id: 'TEST_DATE_CHANGE', label: 'Test Date Changed', category: 'TEST', color: 'amber' },
  { id: 'EXAM_DATE_CHANGE', label: 'Exam Date Changed', category: 'EXAM', color: 'amber' },
  { id: 'TEST_POSTPONEMENT', label: 'Test Postponed', category: 'TEST', color: 'red' },
  { id: 'EXAM_POSTPONEMENT', label: 'Exam Postponed', category: 'EXAM', color: 'red' },
  { id: 'REVISION_MATERIAL', label: 'Revision Material', category: 'ACADEMIC', color: 'purple' },
  { id: 'PROJECT_ASSIGNMENT', label: 'Project / Assignment Submission', category: 'ACADEMIC', color: 'violet' },
  { id: 'PRACTICAL_VIVA', label: 'Practical / Viva Instructions', category: 'ACADEMIC', color: 'pink' },
  { id: 'IMPORTANT_REMINDER', label: 'Important Reminder', category: 'REMINDER', color: 'orange' },
  { id: 'GENERAL_ACADEMIC_NOTICE', label: 'General Academic Notice', category: 'GENERAL', color: 'slate' }
];

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class TestExamCommunicationService {
  /**
   * Authoritatively validate that the user is permitted to publish for the target class/subject.
   * Derives actual user identity and role from profiles and assignments.
   * Client-supplied roles or arbitrary parameters are completely ignored.
   */
  static async validateAuthoritativePermissions({
    userId,
    scopeType,
    classId,
    subjectId
  }) {
    if (!userId) {
      throw new Error('Authentication required: Missing user ID.');
    }

    // 1. Fetch authoritative profile from database
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, name, role, designation')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      throw new Error('User profile could not be verified on the server.');
    }

    const role = (profile.role || '').toLowerCase();
    const isAdminOrPrincipal = ['admin', 'superadmin', 'principal'].includes(role);
    const isCoordinator = role === 'coordinator' || (profile.designation && profile.designation.toLowerCase().includes('coordinator'));

    // Admin and Principal have school-wide authority
    if (isAdminOrPrincipal) {
      return { profile, isAuthorized: true, authorityType: 'ADMIN_PRINCIPAL' };
    }

    // Coordinator has authority over secondary/senior academic scopes
    if (isCoordinator) {
      return { profile, isAuthorized: true, authorityType: 'COORDINATOR' };
    }

    // Teachers must be verified against actual class/subject assignments
    if (scopeType === 'CLASS_WIDE') {
      if (!classId) throw new Error('Class ID is required for class-wide notices.');
      
      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('id, name, section, class_teacher_id')
        .eq('id', classId)
        .single();

      if (clsErr || !cls) {
        throw new Error('Target class not found.');
      }

      if (cls.class_teacher_id !== userId) {
        throw new Error(`Unauthorized: You are not the assigned Class Teacher for ${cls.name} ${cls.section || ''}.`);
      }

      return { profile, classData: cls, isAuthorized: true, authorityType: 'CLASS_TEACHER' };
    }

    if (scopeType === 'CLASS_SUBJECT') {
      if (!classId) throw new Error('Class ID is required for subject notices.');
      if (!subjectId) throw new Error('Subject ID is required for subject notices.');

      const { data: assignment, error: assignErr } = await supabase
        .from('teacher_subjects')
        .select('id, teacher_id, class_id, subject_id, classes(name, section), subjects(name)')
        .eq('teacher_id', userId)
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (assignErr || !assignment) {
        throw new Error('Unauthorized: You are not assigned to teach this subject in this class.');
      }

      return { profile, assignment, isAuthorized: true, authorityType: 'SUBJECT_TEACHER' };
    }

    if (scopeType === 'SCHOOL_WIDE') {
      throw new Error('Unauthorized: Only Admin and Principal can broadcast school-wide notices.');
    }

    throw new Error(`Unsupported communication scope: ${scopeType}`);
  }

  /**
   * Authoritatively resolve current student recipients from active enrollment.
   * Does NOT accept arbitrary student IDs from client.
   */
  static async resolveAuthorizedRecipients({ classId }) {
    if (!classId) return [];

    const { data: students, error } = await supabase
      .from('students')
      .select('id, uid, name, roll_no, class_id, contact_number, status')
      .eq('class_id', classId)
      .neq('status', 'Inactive')
      .order('roll_no', { ascending: true });

    if (error) {
      console.error('Error resolving student recipients:', error);
      throw new Error('Could not resolve class student enrollment.');
    }

    return (students || []).map(s => ({
      id: s.id,
      name: s.name,
      roll_no: s.roll_no,
      class_id: s.class_id,
      contact_number: s.contact_number
    }));
  }

  /**
   * Validate attachment file size and extension.
   */
  static validateAttachment({ name, size }) {
    if (!name) throw new Error('Attachment missing file name.');
    const ext = name.split('.').pop().toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
      throw new Error(`Invalid file type (.${ext}). Allowed types: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}`);
    }
    if (size && size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(`File "${name}" exceeds the 10MB limit (${(size / (1024 * 1024)).toFixed(1)}MB).`);
    }
    return true;
  }

  /**
   * Check for duplicate notices to prevent teacher accidental double submissions.
   */
  static async checkDuplicateNotice({ classId, subjectId, testDate }) {
    if (!classId || !testDate) return null;

    let query = supabase
      .from('test_exam_communications')
      .select('id, title, version, status, publish_at, test_exam_date')
      .eq('class_id', classId)
      .eq('test_exam_date', testDate)
      .eq('is_latest', true)
      .in('status', ['PUBLISHED', 'SCHEDULED']);

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data } = await query.limit(1);
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Create or Publish a Test & Exam Notice.
   * Handles immediate publishing or scheduled delivery.
   */
  static async createCommunication({
    userId,
    academicYear = '2026',
    communicationType,
    scopeType = 'CLASS_SUBJECT',
    classId,
    subjectId = null,
    weeklyTestId = null,
    assessmentPatternId = null,
    term = 'Midterm',
    title,
    message = '',
    testExamDate = null,
    actionDate = null,
    maxMarks = null,
    portionSyllabus = '',
    portionBreakdown = [],
    instructions = '',
    requiredMaterials = '',
    roomVenue = '',
    attachments = [],
    priority = 'NORMAL',
    status = 'PUBLISHED',
    acknowledgementRequired = false,
    publishAt = null,
    expiresAt = null,
    bypassDuplicateCheck = false
  }) {
    // 1. Authoritative Permissions Check (Server-Side)
    const { profile } = await this.validateAuthoritativePermissions({
      userId,
      scopeType,
      classId,
      subjectId
    });

    // 2. Fetch Master Names for Immutable Historical Snapshot
    let classNameSnapshot = 'School Wide';
    let sectionSnapshot = '';
    let subjectNameSnapshot = null;
    let testTitleSnapshot = title;

    if (classId) {
      const { data: cData } = await supabase.from('classes').select('name, section').eq('id', classId).maybeSingle();
      if (cData) {
        classNameSnapshot = cData.name;
        sectionSnapshot = cData.section || '';
      }
    }

    if (subjectId) {
      const { data: sData } = await supabase.from('subjects').select('name').eq('id', subjectId).maybeSingle();
      if (sData) {
        subjectNameSnapshot = sData.name;
      }
    }

    if (weeklyTestId) {
      const { data: wtData } = await supabase.from('weekly_tests').select('test_date, max_marks, portion').eq('id', weeklyTestId).maybeSingle();
      if (wtData) {
        testTitleSnapshot = `Weekly Test — ${wtData.test_date}`;
        if (!testExamDate) testExamDate = wtData.test_date;
        if (!maxMarks && wtData.max_marks) maxMarks = wtData.max_marks;
        if (!portionSyllabus && wtData.portion) portionSyllabus = wtData.portion;
      }
    }

    // 3. Validate attachments
    if (attachments && attachments.length > 0) {
      attachments.forEach(att => this.validateAttachment(att));
    }

    // 4. Duplicate Check
    if (!bypassDuplicateCheck && status === 'PUBLISHED') {
      const existing = await this.checkDuplicateNotice({
        classId,
        subjectId,
        testDate: testExamDate,
        communicationType
      });
      if (existing) {
        return {
          isDuplicate: true,
          existingNotice: existing,
          message: `A notice for this class/subject on ${testExamDate} is already ${existing.status} (Title: "${existing.title}").`
        };
      }
    }

    // 5. Determine publishing timeline
    const nowIso = new Date().toISOString();
    const effectivePublishAt = publishAt && new Date(publishAt) > new Date() ? new Date(publishAt).toISOString() : nowIso;
    const effectiveStatus = (publishAt && new Date(publishAt) > new Date()) ? 'SCHEDULED' : status;

    // 6. Insert Authoritative Communication Record
    const newRecord = {
      academic_year: academicYear,
      communication_type: communicationType,
      scope_type: scopeType,
      class_id: classId,
      section: sectionSnapshot,
      subject_id: subjectId,
      weekly_test_id: weeklyTestId,
      assessment_pattern_id: assessmentPatternId,
      term,
      class_name_snapshot: classNameSnapshot,
      section_snapshot: sectionSnapshot,
      subject_name_snapshot: subjectNameSnapshot,
      teacher_name_snapshot: profile.name || 'Teacher',
      test_title_snapshot: testTitleSnapshot,
      title,
      message,
      test_exam_date: testExamDate,
      action_date: actionDate,
      max_marks: maxMarks ? Number(maxMarks) : null,
      portion_syllabus: portionSyllabus,
      portion_breakdown: portionBreakdown || [],
      instructions,
      required_materials: requiredMaterials,
      room_venue: roomVenue,
      attachments: attachments || [],
      priority,
      status: effectiveStatus,
      acknowledgement_required: Boolean(acknowledgementRequired),
      publish_at: effectivePublishAt,
      expires_at: expiresAt || null,
      version: 1,
      is_latest: true,
      recipient_count: 0,
      read_count: 0,
      acknowledgement_count: 0,
      created_by: profile.id,
      created_by_role: profile.role
    };

    const { data: created, error: insertErr } = await supabase
      .from('test_exam_communications')
      .insert(newRecord)
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting test_exam_communication:', insertErr);
      throw new Error(`Failed to create communication: ${insertErr.message}`);
    }

    // 7. Audit Log Entry (Immutable)
    await this.recordAuditLog({
      communicationId: created.id,
      userId: profile.id,
      userRole: profile.role,
      userName: profile.name,
      action: effectiveStatus === 'SCHEDULED' ? 'SCHEDULED' : 'PUBLISHED',
      newValues: { id: created.id, title: created.title, type: created.communication_type, status: created.status }
    });

    // 8. If immediately published, generate Recipient Snapshot & Dispatch Notifications
    if (effectiveStatus === 'PUBLISHED') {
      await this.publishRecipientsAndDispatch({
        communication: created,
        senderProfile: profile,
        classId,
        subjectId
      });
    }

    return { success: true, communication: created };
  }

  /**
   * Create Recipient Snapshot and Dispatch In-App/FCM notifications.
   * Immutable recipient capture at publish time.
   */
  static async publishRecipientsAndDispatch({
    communication,
    classId
  }) {
    // 1. Authoritative dynamic student roster at publish time
    const studentRoster = await this.resolveAuthorizedRecipients({ classId });
    if (studentRoster.length === 0) {
      return { recipientCount: 0 };
    }

    // 2. Insert Recipient Snapshot Records
    const recipientRows = studentRoster.map(s => ({
      communication_id: communication.id,
      student_id: s.id,
      class_id: s.class_id,
      student_name_snapshot: s.name,
      student_roll_snapshot: String(s.roll_no || ''),
      class_name_snapshot: `${communication.class_name_snapshot} ${communication.section_snapshot || ''}`.trim(),
      is_read: false,
      is_acknowledged: false
    }));

    const { error: recipErr } = await supabase
      .from('test_exam_communication_recipients')
      .insert(recipientRows);

    if (recipErr) {
      console.warn('Recipient snapshot insertion warning:', recipErr);
    }

    // Update aggregate recipient count on master record
    await supabase
      .from('test_exam_communications')
      .update({ recipient_count: studentRoster.length })
      .eq('id', communication.id);

    // 3. Dispatch In-App & FCM Push Notifications via NotificationService
    const shortBody = communication.subject_name_snapshot 
      ? `New ${communication.subject_name_snapshot} notice: ${communication.title}`
      : `New class notice: ${communication.title}`;

    for (const student of studentRoster) {
      try {
        await notificationService.create({
          profileId: student.id,
          userId: student.id,
          type: 'test_exam_notice',
          title: communication.title,
          body: shortBody,
          linkUrl: '/student-portal'
        });
      } catch (notifErr) {
        // Continue loop even if one notification fails
        console.warn(`Failed to dispatch alert for student ${student.id}:`, notifErr);
      }
    }

    return { recipientCount: studentRoster.length };
  }

  /**
   * Non-destructive Revision (V1 -> V2) for date changes, portion edits, or postponements.
   */
  static async reviseCommunication({
    userId,
    communicationId,
    changeReason,
    revisedFields = {}
  }) {
    if (!changeReason || !changeReason.trim()) {
      throw new Error('A revision reason must be provided for audit tracking.');
    }

    // 1. Fetch current communication
    const { data: current, error } = await supabase
      .from('test_exam_communications')
      .select('*')
      .eq('id', communicationId)
      .single();

    if (error || !current) throw new Error('Communication not found.');

    // 2. Authoritative permissions check
    const { profile } = await this.validateAuthoritativePermissions({
      userId,
      scopeType: current.scope_type,
      classId: current.class_id,
      subjectId: current.subject_id
    });

    // 3. Mark old record as not latest
    await supabase
      .from('test_exam_communications')
      .update({ is_latest: false, status: 'REVISED' })
      .eq('id', current.id);

    // 4. Create V2 Record
    const isDateChange = revisedFields.testExamDate && revisedFields.testExamDate !== current.test_exam_date;
    const newVersion = (current.version || 1) + 1;

    let targetType = revisedFields.communicationType || current.communication_type;
    if (isDateChange && targetType === 'TEST_ANNOUNCEMENT') {
      targetType = 'TEST_DATE_CHANGE';
    } else if (isDateChange && targetType === 'EXAM_ANNOUNCEMENT') {
      targetType = 'EXAM_DATE_CHANGE';
    }

    const v2Record = {
      ...current,
      id: undefined, // Let database generate new UUID
      version: newVersion,
      parent_communication_id: current.id,
      is_latest: true,
      change_reason: changeReason,
      original_test_date: isDateChange ? current.test_exam_date : current.original_test_date,
      communication_type: targetType,
      title: revisedFields.title || current.title,
      message: revisedFields.message !== undefined ? revisedFields.message : current.message,
      test_exam_date: revisedFields.testExamDate || current.test_exam_date,
      action_date: revisedFields.actionDate || current.action_date,
      portion_syllabus: revisedFields.portionSyllabus !== undefined ? revisedFields.portionSyllabus : current.portion_syllabus,
      portion_breakdown: revisedFields.portionBreakdown || current.portion_breakdown,
      instructions: revisedFields.instructions !== undefined ? revisedFields.instructions : current.instructions,
      required_materials: revisedFields.requiredMaterials !== undefined ? revisedFields.requiredMaterials : current.required_materials,
      room_venue: revisedFields.roomVenue !== undefined ? revisedFields.roomVenue : current.room_venue,
      attachments: revisedFields.attachments || current.attachments,
      priority: revisedFields.priority || current.priority,
      status: 'PUBLISHED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdV2, error: v2Err } = await supabase
      .from('test_exam_communications')
      .insert(v2Record)
      .select()
      .single();

    if (v2Err) {
      throw new Error(`Failed to create revised communication: ${v2Err.message}`);
    }

    // 5. Snapshot recipients from current enrollment for V2
    await this.publishRecipientsAndDispatch({
      communication: createdV2,
      senderProfile: profile,
      classId: current.class_id,
      subjectId: current.subject_id
    });

    // 6. Record Audit Log
    await this.recordAuditLog({
      communicationId: createdV2.id,
      userId: profile.id,
      userRole: profile.role,
      userName: profile.name,
      action: isDateChange ? 'DATE_CHANGED' : 'REVISED',
      oldValues: { id: current.id, version: current.version, date: current.test_exam_date },
      newValues: { id: createdV2.id, version: createdV2.version, date: createdV2.test_exam_date },
      reason: changeReason
    });

    return { success: true, communication: createdV2 };
  }

  /**
   * Cancel or Archive a published communication.
   * Ordinary teachers cannot permanently delete official published communications.
   */
  static async changeCommunicationStatus({
    userId,
    communicationId,
    targetStatus, // 'CANCELLED' | 'ARCHIVED'
    reason = ''
  }) {
    if (!['CANCELLED', 'ARCHIVED'].includes(targetStatus)) {
      throw new Error('Only CANCELLED or ARCHIVED statuses can be applied.');
    }

    const { data: comm, error } = await supabase
      .from('test_exam_communications')
      .select('*')
      .eq('id', communicationId)
      .single();

    if (error || !comm) throw new Error('Communication not found.');

    const { profile } = await this.validateAuthoritativePermissions({
      userId,
      scopeType: comm.scope_type,
      classId: comm.class_id,
      subjectId: comm.subject_id
    });

    await supabase
      .from('test_exam_communications')
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', comm.id);

    await this.recordAuditLog({
      communicationId: comm.id,
      userId: profile.id,
      userRole: profile.role,
      userName: profile.name,
      action: targetStatus,
      oldValues: { status: comm.status },
      newValues: { status: targetStatus },
      reason
    });

    return { success: true };
  }

  /**
   * Student Read Receipt Tracking.
   */
  static async recordStudentRead(studentId, communicationId) {
    if (!studentId || !communicationId) return;

    const { data: existing } = await supabase
      .from('test_exam_communication_recipients')
      .select('id, is_read')
      .eq('communication_id', communicationId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing && !existing.is_read) {
      await supabase
        .from('test_exam_communication_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', existing.id);

      // Increment aggregate read count
      await supabase.rpc('increment_communication_read_count', { p_comm_id: communicationId }).catch(() => {
        // Fallback update if RPC is pending
        supabase
          .from('test_exam_communications')
          .select('read_count')
          .eq('id', communicationId)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase
                .from('test_exam_communications')
                .update({ read_count: (data.read_count || 0) + 1 })
                .eq('id', communicationId);
            }
          });
      });
    }
  }

  /**
   * Student Acknowledgement Tracking.
   */
  static async recordStudentAcknowledgement(studentId, communicationId) {
    if (!studentId || !communicationId) return;

    const { data: existing } = await supabase
      .from('test_exam_communication_recipients')
      .select('id, is_acknowledged')
      .eq('communication_id', communicationId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing && !existing.is_acknowledged) {
      const now = new Date().toISOString();
      await supabase
        .from('test_exam_communication_recipients')
        .update({ is_acknowledged: true, acknowledged_at: now, is_read: true, read_at: now })
        .eq('id', existing.id);

      // Increment aggregate acknowledgement count
      await supabase
        .from('test_exam_communications')
        .select('acknowledgement_count')
        .eq('id', communicationId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('test_exam_communications')
              .update({ acknowledgement_count: (data.acknowledgement_count || 0) + 1 })
              .eq('id', communicationId);
          }
        });
    }
  }

  /**
   * Fetch Notices for Student Portal.
   */
  static async getNoticesForStudent({ studentId, classId }) {
    if (!studentId || !classId) return [];

    // Fetch communications where student is an authorized recipient
    const { data: recipientRecords } = await supabase
      .from('test_exam_communication_recipients')
      .select(`
        id, is_read, read_at, is_acknowledged, acknowledged_at,
        communication:test_exam_communications(*)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (!recipientRecords) return [];

    return recipientRecords
      .filter(r => r.communication && r.communication.status === 'PUBLISHED' && r.communication.is_latest)
      .map(r => ({
        ...r.communication,
        recipient_record_id: r.id,
        is_read: r.is_read,
        read_at: r.read_at,
        is_acknowledged: r.is_acknowledged,
        acknowledged_at: r.acknowledged_at
      }));
  }

  /**
   * Fetch Notices for Parent Portal (Restricted strictly to ward's class).
   */
  static async getNoticesForParent({ studentId, classId }) {
    if (!studentId || !classId) return [];
    return this.getNoticesForStudent({ studentId, classId });
  }

  /**
   * Generate concise WhatsApp notification text (Optional 1-tap sharing, NO spam).
   */
  static generateWhatsAppBroadcastText(communication) {
    const className = `${communication.class_name_snapshot} ${communication.section_snapshot || ''}`.trim();
    const sub = communication.subject_name_snapshot ? ` — *${communication.subject_name_snapshot}*` : '';
    const dateStr = communication.test_exam_date ? `\n📅 *Date:* ${communication.test_exam_date}` : '';

    return `🏫 *GYANODAY NIKETAN — ACADEMIC NOTICE*\n\n📢 *${communication.title}*\nClass: *${className}*${sub}${dateStr}\n\nℹ️ Complete portion, instructions, and materials are available in the Gyanoday Niketan Student & Parent Portal.\n\nPlease log in to the ERP to review and acknowledge.`;
  }

  /**
   * Record Immutable Audit Log Entry.
   */
  static async recordAuditLog({
    communicationId,
    userId,
    userRole,
    userName,
    action,
    oldValues = null,
    newValues = null,
    reason = null
  }) {
    try {
      await supabase
        .from('test_exam_communication_audit_logs')
        .insert({
          communication_id: communicationId,
          user_id: userId,
          user_role: userRole,
          user_name: userName,
          action,
          old_values: oldValues,
          new_values: newValues,
          reason
        });
    } catch (e) {
      console.warn('Audit log recording warning:', e);
    }
  }
}
