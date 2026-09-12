/**
 * MarksWorkflowService.js
 * Authoritative Server Operations & Workflow Orchestrator
 * Integrates directly with PostgreSQL RPCs and Schema
 */

import { supabase } from '../lib/supabase';
import { MarksCalculationEngine } from './MarksCalculationEngine';

export class MarksWorkflowService {
  /**
   * Fetch all active assessment patterns with components and grade boundaries
   */
  static async getAssessmentPatterns(academicYear = '2026') {
    const { data: patterns, error: pErr } = await supabase
      .from('assessment_patterns')
      .select(`
        *,
        components:assessment_components(*),
        grade_boundaries:grade_boundaries(*),
        subject_rules:subject_assessment_rules(*)
      `)
      .order('created_at', { ascending: true });

    if (pErr) {
      console.warn('Could not fetch assessment_patterns (table may be pending migration):', pErr.message);
      return [];
    }

    return patterns || [];
  }

  /**
   * Get or initialize submission for a class, subject, term, and academic year
   */
  static async getOrCreateSubmission({ classId, subjectId, teacherId, academicYear, term, patternId }) {
    // 1. Try to find existing submission
    const { data: existing, error: sErr } = await supabase
      .from('class_subject_mark_submissions')
      .select('*')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('academic_year', academicYear)
      .eq('term', term)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // 2. Create draft submission
    const { data: created, error: cErr } = await supabase
      .from('class_subject_mark_submissions')
      .insert([{
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        academic_year: academicYear,
        term: term,
        pattern_id: patternId || null,
        status: 'DRAFT'
      }])
      .select()
      .single();

    if (cErr) {
      // Could be race condition, retry fetch
      const { data: retry } = await supabase
        .from('class_subject_mark_submissions')
        .select('*')
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('academic_year', academicYear)
        .eq('term', term)
        .maybeSingle();
      return retry || null;
    }

    return created;
  }

  /**
   * Fetch detailed marks for a submission
   */
  static async getSubmissionDetailedMarks(submissionId) {
    const { data, error } = await supabase
      .from('student_marks_detailed')
      .select('*')
      .eq('submission_id', submissionId);

    if (error) {
      console.error('Error fetching student_marks_detailed:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Save draft marks for a class & subject
   * Also synchronizes with legacy public.marks for complete backward compatibility
   */
  static async saveDraftMarks({
    submissionId,
    classId,
    subjectId,
    academicYear,
    term,
    detailedMarksList = [], // array of { studentId, componentId, rawScore, convertedScore, status }
    legacyMarksPayload = []  // array of { student_id, subject_id, term, score }
  }) {
    // 1. Upsert detailed marks
    if (detailedMarksList.length > 0) {
      const formatted = detailedMarksList.map(m => ({
        submission_id: submissionId,
        student_id: m.studentId,
        component_id: m.componentId,
        raw_score: m.rawScore !== undefined && m.rawScore !== '' && m.rawScore !== null ? Number(m.rawScore) : null,
        converted_score: m.convertedScore !== undefined && m.convertedScore !== null ? Number(m.convertedScore) : null,
        status: m.status || 'MARKED',
        updated_at: new Date().toISOString()
      }));

      const { error: dErr } = await supabase
        .from('student_marks_detailed')
        .upsert(formatted, { onConflict: 'submission_id,student_id,component_id' });

      if (dErr) throw dErr;
    }

    // 2. Synchronize legacy public.marks
    if (legacyMarksPayload.length > 0) {
      const { error: legErr } = await supabase
        .from('marks')
        .upsert(legacyMarksPayload, { onConflict: 'student_id,subject_id,term' });

      if (legErr) console.warn('Legacy marks sync notice:', legErr.message);
    }

    // 3. Update submission timestamp
    await supabase
      .from('class_subject_mark_submissions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    return { success: true };
  }

  /**
   * Submit marksheet for Coordinator review (Server RPC)
   */
  static async submitForReview({ submissionId, notes = '' }) {
    const { data, error } = await supabase.rpc('submit_class_subject_marks', {
      p_submission_id: submissionId,
      p_notes: notes.trim() || null
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('CANNOT_SUBMIT_EMPTY_MARKSHEET')) {
        throw new Error('Cannot submit an empty marksheet. Please enter student marks first.');
      }
      if (msg.includes('UNAUTHORIZED_SUBMISSION')) {
        throw new Error('Unauthorized: You are not the assigned teacher for this marksheet.');
      }
      if (msg.includes('INVALID_STATE_TRANSITION')) {
        throw new Error('This marksheet is already submitted or locked and cannot be submitted again.');
      }
      throw error;
    }

    return data;
  }

  /**
   * Coordinator review action (Approve, Lock, or Return for Correction)
   */
  static async reviewSubmission({ submissionId, action, reason = null }) {
    const { data, error } = await supabase.rpc('coordinator_review_submission', {
      p_submission_id: submissionId,
      p_action: action,
      p_reason: reason ? reason.trim() : null
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('MANDATORY_REASON_REQUIRED')) {
        throw new Error('Please provide a specific reason explaining why marks are being returned for correction.');
      }
      if (msg.includes('UNAUTHORIZED_COORDINATOR_ACTION')) {
        throw new Error('Unauthorized: Only School Coordinators or Administrators can review and approve marks.');
      }
      if (msg.includes('CANNOT_LOCK')) {
        throw new Error('Marks must be APPROVED before they can be locked.');
      }
      throw error;
    }

    return data;
  }

  /**
   * Verify whether a class is ready for official report printing (Server RPC gatekeeper)
   */
  static async verifyReportReadiness({ classId, academicYear, term }) {
    const { data, error } = await supabase.rpc('verify_class_report_readiness', {
      p_class_id: classId,
      p_academic_year: academicYear,
      p_term: term
    });

    if (error) {
      console.error('Error checking report readiness:', error);
      return { isReady: false, totalSubjects: 0, lockedSubjects: 0, pendingSubjectsCount: 0, unlockedSubjects: [] };
    }

    return data;
  }

  /**
   * Log an official report card generation/print event
   */
  static async logPrintEvent({ classId, academicYear, term, reportVersion, studentCount, notes = '' }) {
    const { data, error } = await supabase.rpc('log_report_print_event', {
      p_academic_year: academicYear,
      p_term: term,
      p_class_id: classId,
      p_report_version: reportVersion,
      p_student_count: studentCount,
      p_notes: notes.trim() || null
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('PREMATURE_PRINTING_BLOCKED')) {
        throw new Error(msg.replace(/^.*?PREMATURE_PRINTING_BLOCKED:\s*/, ''));
      }
      throw error;
    }

    return data;
  }

  /**
   * Principal/Admin exceptional override
   */
  static async principalOverrideMark({ detailedMarkId, newRawScore, newStatus = 'MARKED', reason }) {
    const { data, error } = await supabase.rpc('principal_override_mark', {
      p_detailed_mark_id: detailedMarkId,
      p_new_raw_score: newRawScore !== '' && newRawScore !== null ? Number(newRawScore) : null,
      p_new_status: newStatus,
      p_reason: reason.trim()
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('REASON_REQUIRED')) {
        throw new Error('A documented audit reason is required for an exceptional override.');
      }
      if (msg.includes('UNAUTHORIZED')) {
        throw new Error('Unauthorized: Only Principal or Administrator can perform exceptional overrides.');
      }
      throw error;
    }

    return data;
  }
}

export default MarksWorkflowService;
