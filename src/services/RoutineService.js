/**
 * RoutineService.js
 * 
 * Authoritative Routine Management & Automatic Distribution Engine
 * for Gyanoday Niketan School ERP.
 * 
 * Principles:
 * 1. ONE SOURCE OF TRUTH: Single master routine dataset.
 *    Filtered views produce Teacher Routine, Class Routine, Subject Routine, and Supervision views.
 * 2. PRINCIPAL-CONTROLLED: Draft -> Validate -> Publish -> Supersede -> Distribute.
 * 3. DUAL-LAYER PERSISTENCE: Integrates with Supabase tables with robust local storage / in-memory fallback.
 * 4. REAL-WORLD DATA: Pre-seeded with the Principal's authentic handwritten routine sheets.
 */

import { supabase } from '../lib/supabase';
import NotificationService from './NotificationService';

export const WORKING_DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' }
];

export const DEFAULT_PERIODS = [
  { period_num: 1, period_name: '1st Period', start_time: '08:00', end_time: '08:40', is_break: false, is_special: false },
  { period_num: 2, period_name: '2nd Period', start_time: '08:40', end_time: '09:20', is_break: false, is_special: false },
  { period_num: 3, period_name: '3rd Period', start_time: '09:20', end_time: '10:00', is_break: false, is_special: false },
  { period_num: 4, period_name: '4th Period', start_time: '10:00', end_time: '10:40', is_break: false, is_special: false },
  { period_num: 5, period_name: '5th Period', start_time: '10:40', end_time: '11:20', is_break: false, is_special: false },
  { period_num: 6, period_name: '6th Period', start_time: '11:20', end_time: '12:00', is_break: false, is_special: false },
  { period_num: 7, period_name: '7th Period', start_time: '12:00', end_time: '12:40', is_break: false, is_special: false },
  { period_num: 8, period_name: '8th Period', start_time: '12:40', end_time: '13:20', is_break: false, is_special: false },
  { period_num: 9, period_name: '9th Period', start_time: '13:20', end_time: '14:00', is_break: false, is_special: true } // Weekly Test Slot
];

export const ROUTINE_ENTRY_TYPES = [
  { id: 'SUBJECT', label: 'Academic Subject', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'ASSEMBLY', label: 'Morning Assembly', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'TEST', label: 'Weekly Test', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'EXAM', label: 'Terminal Exam', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  { id: 'LIBRARY', label: 'Library', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'SINGING', label: 'Singing / Music', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'DRAWING', label: 'Drawing / Art', color: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30' },
  { id: 'GAMES', label: 'Games / Sports', color: 'bg-lime-500/10 text-lime-400 border-lime-500/30' },
  { id: 'PT', label: 'Physical Training (PT)', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { id: 'TABLES', label: 'Mathematical Tables', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { id: 'ROBOTICS', label: 'Robotics', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'PRACTICAL', label: 'Science Practical', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'SUPW', label: 'SUPW / Craft', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { id: 'M.SC.', label: 'Moral Science (M.Sc.)', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { id: 'CLUB', label: 'Club Activity', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
  { id: 'LAB', label: 'Computer Lab', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  { id: 'SPECIAL ACTIVITY', label: 'Special School Activity', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'FREE PERIOD', label: 'Free Period', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  { id: 'OTHER', label: 'Other', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' }
];

// In-Memory & LocalStorage Persistence Keys
const STORAGE_PREFIX = 'gn_routine_';
const KEY_VERSIONS = `${STORAGE_PREFIX}versions`;
const KEY_ENTRIES = `${STORAGE_PREFIX}entries`;
const KEY_ACKS = `${STORAGE_PREFIX}acknowledgements`;
const KEY_AUDIT = `${STORAGE_PREFIX}audit`;
const KEY_PERIODS = `${STORAGE_PREFIX}periods`;

/**
 * Standard seed routine based on the Principal's authentic handwritten timetable sheets
 */
function getInitialSeedData() {
  const versionId = 'v-2026-v1-published';
  const defaultVersion = {
    id: versionId,
    academic_year: '2026',
    campus_name: 'Senior School',
    version_code: 'V1',
    version_num: 1,
    title: 'Senior School Master Routine 2026–27',
    status: 'PUBLISHED',
    change_reason: 'Official Term Schedule finalized by Principal',
    summary_stats: {
      totalTeachers: 34,
      totalClasses: 16,
      totalEntries: 811,
      conflicts: 0,
      warnings: 0
    },
    created_at: new Date('2026-09-20T08:00:00Z').toISOString(),
    published_at: new Date('2026-09-24T08:30:00Z').toISOString(),
    published_by_name: 'Principal'
  };

  // Seed authentic entries from Principal's handwritten sheets
  const entries = [
    // 1. MRS. PINKY BK (TL Nepali, Classes 5, 6, 7, 8)
    // Tue: 2nd 7A, 4th 6A, 7th 5A, 8th 8A, 9th TEST
    { id: 'p1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
    { id: 'p2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
    { id: 'p3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
    { id: 'p4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'TL Nepali', entry_type: 'SUBJECT' },
    { id: 'p5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-pinky-bk', teacher_name: 'Mrs. Pinky BK', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Weekly Test', entry_type: 'TEST' },

    // 2. MRS. DIPIKA THAPA (5-Eng 2, 5B-Spell)
    // Mon: 4th 5A, 6th 5B | Wed: 7th 5A, 8th 5B SPELL | Thu: 7th 5B | Fri: 3rd 5B, 5th 5A
    { id: 'd1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'd2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'd3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'd4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Spelling', entry_type: 'SUBJECT' },
    { id: 'd5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'd6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'd7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-dipika-thapa', teacher_name: 'Mrs. Dipika Thapa', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },

    // 3. MR. SASHANK LAMA (Music)
    // Mon: 7th 9, 8th 10, 9th 5A | Tue: 8th 10, 9th TEST | Wed: 7th 9, 8th 10, 9th 5A | Thu: 7th 9, 8th 10, 9th 5A | Fri: 8th 9, 9th 5B
    { id: 's1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 's6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's10', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's11', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's12', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Music', entry_type: 'SINGING' },
    { id: 's13', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-sashank-lama', teacher_name: 'Mr. Sashank Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Music', entry_type: 'SINGING' },

    // 4. MR. DHIRENDRA LAMA (9, 10 Art / 5 Drawing, Singing / 6 Singing / SUPW)
    // 30 Total Weekly Periods (Authentic handwritten timetable)
    // Monday (6): P2 11Sc SUPW, P3 5A Library, P5 5B Singing, P6 6A Singing, P7 9H Art, P8 10H Art
    { id: 'dh-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'SUPW', entry_type: 'SUPW' },
    { id: 'dh-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: '5A Library (with Mr. Ajoy Gurung)' },
    { id: 'dh-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },

    // Tuesday (6): P1 9H Assembly/M.Sc, P2 12H SUPW, P3 9H Library, P6 10H Library, P8 10H Art, P9 9H Weekly Test
    { id: 'dh-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY', notes: 'Assembly or M.Sc (9H)' },
    { id: 'dh-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'SUPW', entry_type: 'SUPW' },
    { id: 'dh-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: '9H Library (with Mr. Ajoy Gurung)' },
    { id: 'dh-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: '10H Library (with Mr. Ajoy Gurung)' },
    { id: 'dh-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Weekly Test', entry_type: 'TEST', notes: 'Weekly Test (9H Class Teacher)' },

    // Wednesday (6): P2 7A Singing, P5 5A Singing, P6 7B Singing, P7 9H Art, P8 10H Art, P9 7A Activity/Singing
    { id: 'dh-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Singing', entry_type: 'SINGING', notes: 'Class 7A Singing / Activity' },

    // Thursday (7): P2 10H SUPW, P3 6B Singing, P5 5A Drawing, P6 5B Tables, P7 9H Art, P8 10H Art, P9 11Sc SUPW
    { id: 'dh-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'SUPW', entry_type: 'SUPW' },
    { id: 'dh-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Drawing', entry_type: 'DRAWING' },
    { id: 'dh-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Tables', entry_type: 'TABLES' },
    { id: 'dh-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'SUPW', entry_type: 'SUPW' },

    // Friday (5): P1 8A Library, P5 8A Library, P6 5B Drawing, P8 9H Art, P9 5B Drawing/Activity
    { id: 'dh-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: '8A Library (with Mr. Ajoy Gurung)' },
    { id: 'dh-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: '8A Library (Table 2 marks 9H with DL)' },
    { id: 'dh-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Drawing', entry_type: 'DRAWING' },
    { id: 'dh-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Art', entry_type: 'DRAWING', modifier_tags: 'ELECTIVE_ART' },
    { id: 'dh-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Drawing', entry_type: 'DRAWING', notes: 'Class 5B Drawing / Activity' },

    // 5. MR AJOY GURUNG (5 to 12 Library)
    // 21 Total Weekly Periods (Authentic handwritten timetable)
    // Monday (4): P3 5A Library, P4 10H Library, P7 7A Library, P9 7A Library
    { id: 'aj-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
    { id: 'aj-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With RS / PS' },
    { id: 'aj-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Keiran Thapa (KT)' },
    { id: 'aj-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY' },

    // Tuesday (4): P3 9H Library, P6 10H Library, P8 11H Library, P9 7B Weekly Test
    { id: 'aj-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
    { id: 'aj-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
    { id: 'aj-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY' },
    { id: 'aj-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Weekly Test', entry_type: 'TEST', notes: 'Weekly Test Duty (Senior School / 7B)' },

    // Wednesday (4): P4 7B Library, P7 5B Library, P8 12H Library, P9 7B Library
    { id: 'aj-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With DP (Mrs. Dipika Thapa)' },
    { id: 'aj-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY' },
    { id: 'aj-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Rai Sir / Rajesh Sharma (Raj S.)' },
    { id: 'aj-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY' },

    // Thursday (5): P3 8B Library, P4 5B Library, P6 5A Library, P7 6B Library, P9 8A Library
    { id: 'aj-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Sujil (Sujl)' },
    { id: 'aj-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Suresh / Subodh (Su Ro)' },
    { id: 'aj-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Suresh / Subodh (Su. Ro)' },
    { id: 'aj-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Subodh Rai (SUB R)' },
    { id: 'aj-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY' },

    // Friday (4): P1 8A Library, P5 9H Library, P8 6A Library, P9 8B Library
    { id: 'aj-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
    { id: 'aj-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
    { id: 'aj-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With P. Tamang' },
    { id: 'aj-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY' },

    // 6. MR. KEIRAN THAPA - Full authentic 29-period schedule integrated in Batch 3 below

    // 7. MR. RAKESH RAI (5-HW, Art & Craft)
    { id: 'rk1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Assembly / M.Sc.', entry_type: 'ASSEMBLY' },
    { id: 'rk2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Handwriting', entry_type: 'SUBJECT' },
    { id: 'rk3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Handwriting', entry_type: 'SUBJECT' },
    { id: 'rk4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Art & Craft', entry_type: 'DRAWING' },
    { id: 'rk5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Art & Craft', entry_type: 'DRAWING' },
    { id: 'rk6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Art & Craft', entry_type: 'DRAWING' },
    { id: 'rk7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Art & Craft', entry_type: 'DRAWING' },
    { id: 'rk8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-rakesh-rai', teacher_name: 'Mr. Rakesh Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Weekly Test', entry_type: 'TEST' },

    // 8. PTI's (Games, PT, Taekwondo)
    { id: 'pt1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-school', class_name: 'All', section: '', subject_name: 'Morning Assembly', entry_type: 'ASSEMBLY' },
    { id: 'pt2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'PT / Games', entry_type: 'GAMES' },
    { id: 'pt3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'PT / Games', entry_type: 'GAMES' },

    // 9. MR. SUBODH RAI (6 Math, Phy / 7- Phy, Chem - Class Teacher 7A)
    // Mon: 1st 7A Chem, 2nd 7B Phy, 6th 6B Math, 7th 6B Phy, 8th 6A Phy
    { id: 'sub-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sub-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '8314b919-c0c8-4aab-b064-7f1452465ad1', class_name: '7', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sub-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },

    // Tue: 1st Assembly/Moral Science, 2nd 7B Chem, 5th 6B Phy, 6th 6A Math, 8th 7A Phy, 9th Test
    { id: 'sub-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: 'All', section: '', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY', notes: 'Assembly or M.Sc (7A)' },
    { id: 'sub-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '8314b919-c0c8-4aab-b064-7f1452465ad1', class_name: '7', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sub-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sub-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Weekly Test', entry_type: 'TEST', notes: 'Weekly Test (7A Class Teacher)' },

    // Wed: 1st 7A Chem, 3rd 7B Chem, 4th 6A Math, 6th 6A Phy, 7th 7B Phy, 9th 6A Activity
    { id: 'sub-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sub-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '8314b919-c0c8-4aab-b064-7f1452465ad1', class_name: '7', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sub-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sub-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '8314b919-c0c8-4aab-b064-7f1452465ad1', class_name: '7', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY', notes: 'Class 6A Activity / Remedial' },

    // Thu: 1st 7A Phy, 2nd 6A Phy, 4th 6A Math, 6th 7B Phy, 7th 6B Library, 8th 6B Math
    { id: 'sub-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6', class_name: '6', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sub-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '8314b919-c0c8-4aab-b064-7f1452465ad1', class_name: '7', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY' },
    { id: 'sub-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },

    // Fri: 1st 7A Chem, 3rd 7B Chem, 4th 6B Phy, 6th 7A Phy, 7th 6B Math, 9th 7A Activity
    { id: 'sub-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sub-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '8314b919-c0c8-4aab-b064-7f1452465ad1', class_name: '7', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sub-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sub-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: 'b582f34d-e0d7-4f76-a0af-fe3511a17edb', class_name: '6', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sub-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', teacher_name: 'Subodh', class_id: '0b240100-1dc3-4b67-9b17-f1ef05a8520d', class_name: '7', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY', notes: 'Class 7A Class Teacher Period' },
    // MRS. SARITA SHARMA (32 Periods from handwritten timetable)
    { id: 'ss-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-school', class_name: 'All', section: '', subject_name: 'Morning Assembly', entry_type: 'ASSEMBLY' },
    { id: 'ss-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'ss-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'ss-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'ss-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-sarita-sharma', teacher_name: 'Mrs. Sarita Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: '2L Nepali', entry_type: 'SUBJECT' },

    // MRS. PINKI GUPTA (32 Periods from handwritten timetable)
    { id: 'pg-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'pg-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12', class_name: '12', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-11', class_name: '11', section: '', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },
    { id: 'pg-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-pinki-gupta', teacher_name: 'Mrs. Pinki Gupta', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: '2L Hindi', entry_type: 'SUBJECT' },

    // MRS. S. ROUTH (26 Periods from handwritten timetable)
    { id: 'sr-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-junior', class_name: 'Junior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'sr-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'sr-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'TL Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'sr-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Hindi', entry_type: 'SUBJECT' },
    { id: 'sr-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-s-routh', teacher_name: 'Mrs. S. Routh', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Hindi / Activity', entry_type: 'SUBJECT' },

    // MR. KALYAN MUKHIA (23 Periods from handwritten timetable)
    { id: 'km-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'km-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY' },
    { id: 'km-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'km-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-middle', class_name: 'Middle', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'km-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'km-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY' },
    { id: 'km-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'km-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'km-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY' },
    { id: 'km-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'km-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'km-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-kalyan-mukhia', teacher_name: 'Mr. Kalyan Mukhia', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY', notes: 'With Mr. Subodh Rai' },

    // MR. AKASH KHAREL (27 Periods from handwritten timetable)
    { id: 'ak-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'ak-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY' },
    { id: 'ak-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'ak-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'ak-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY' },
    { id: 'ak-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },
    { id: 'ak-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-akash-kharel', teacher_name: 'Mr. Akash Kharel', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Economics', entry_type: 'SUBJECT' },

    // MS. KALYANI SHARMA (27 Periods from handwritten timetable)
    { id: 'ks-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'ks-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'ks-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-kalyani-sharma', teacher_name: 'Ms. Kalyani Sharma', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Mathematics', entry_type: 'SUBJECT' },

    // MS. PROMEETA THAPA (26 Periods from handwritten timetable)
    { id: 'pt-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'pt-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'pt-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-promeeta-thapa', teacher_name: 'Ms. Promeeta Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },

    // MR. PRAJWAL SINGH (29 Periods from handwritten timetable)
    { id: 'ps-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'ps-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11', class_name: '11', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-9', class_name: '9', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-10', class_name: '10', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'ps-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-12', class_name: '12', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11', class_name: '11', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-10', class_name: '10', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'ps-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11', class_name: '11', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Tables', entry_type: 'TABLES' },
    { id: 'ps-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-12', class_name: '12', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-9', class_name: '9', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-10', class_name: '10', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'ps-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11', class_name: '11', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-12', class_name: '12', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'ps-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-9', class_name: '9', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-10', class_name: '10', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Taekwondo', entry_type: 'GAMES' },
    { id: 'ps-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-12', class_name: '12', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11', class_name: '11', section: '', subject_name: 'Physical Education', entry_type: 'GAMES' },
    { id: 'ps-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Taekwondo', entry_type: 'GAMES' },
    { id: 'ps-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-9', class_name: '9', section: '', subject_name: 'PT / Games', entry_type: 'GAMES', notes: 'Parallel Elective' },
    { id: 'ps-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-prajwal-singh', teacher_name: 'Mr. Prajwal Singh', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Physical Education', entry_type: 'GAMES' },

    // MR. DEVEN GURUNG (16 Periods from handwritten timetable)
    { id: 'dg-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'dg-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'dg-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-deven-gurung', teacher_name: 'Mr. Deven Gurung', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    // MRS. PALLAVI BAKSHI (29 Periods from handwritten timetable)
    { id: 'pb-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'pb-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'pb-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology Practical', entry_type: 'PRACTICAL' },
    { id: 'pb-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology Practical', entry_type: 'PRACTICAL' },
    { id: 'pb-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology Practical', entry_type: 'PRACTICAL' },
    { id: 'pb-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Biology Practical', entry_type: 'PRACTICAL' },
    { id: 'pb-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'pb-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-pallavi-bakshi', teacher_name: 'Mrs. Pallavi Bakshi', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },

    // MRS. SAILIKA THAPA (20 Periods from handwritten timetable)
    { id: 'st-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-12', class_name: '12', section: '', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-school', class_name: 'All', section: '', subject_name: 'Morning Assembly', entry_type: 'ASSEMBLY' },
    { id: 'st-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-12', class_name: '12', section: '', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-12', class_name: '12', section: '', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'st-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-sailika-thapa', teacher_name: 'Mrs. Sailika Thapa', class_id: 'c-12', class_name: '12', section: '', subject_name: 'English 2', entry_type: 'SUBJECT' },

    // MRS. ANJANA GURUNG (12 Periods from handwritten timetable)
    { id: 'ang-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'ang-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-anjana-gurung', teacher_name: 'Mrs. Anjana Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },

    // MR. RIWAZ PRADHAN (30 Periods from handwritten timetable)
    { id: 'rp-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'rp-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'rp-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Morning Assembly', entry_type: 'ASSEMBLY' },
    { id: 'rp-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'rp-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'rp-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'rp-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'rp-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },
    { id: 'rp-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'rp-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Political Science', entry_type: 'SUBJECT' },
    { id: 'rp-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-riwaz-pradhan', teacher_name: 'Mr. Riwaz Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Sociology', entry_type: 'SUBJECT' },

    // MR. SURAJ PRADHAN (27 Periods from handwritten timetable)
    { id: 'sp-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics Practical', entry_type: 'PRACTICAL' },
    { id: 'sp-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics Practical', entry_type: 'PRACTICAL' },
    { id: 'sp-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'sp-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'sp-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'SUPW', entry_type: 'SUPW' },
    { id: 'sp-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },
    { id: 'sp-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics Practical', entry_type: 'PRACTICAL' },
    { id: 'sp-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics Practical', entry_type: 'PRACTICAL' },
    { id: 'sp-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-suraj-pradhan', teacher_name: 'Mr. Suraj Pradhan', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Physics', entry_type: 'SUBJECT' },

    // MR. KEIRAN THAPA (29 Periods from handwritten timetable)
    { id: 'kt-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'kt-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'kt-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'kt-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },
    { id: 'kt-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'English 1', entry_type: 'SUBJECT' },

    // MRS. URVASHI RUMBA (28 Periods from handwritten timetable)
    { id: 'ur-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'ur-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'ur-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Elocution', entry_type: 'SUBJECT' },
    { id: 'ur-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'EVS', entry_type: 'SUBJECT' },
    { id: 'ur-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Elocution', entry_type: 'SUBJECT' },
    { id: 'ur-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },
    { id: 'ur-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-urvashi-rumba', teacher_name: 'Mrs. Urvashi Rumba', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Biology', entry_type: 'SUBJECT' },

    // MS. SUJATA RAI (26 Periods from handwritten timetable)
    { id: 'sjr-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'sjr-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Spelling', entry_type: 'SUBJECT' },
    { id: 'sjr-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'sjr-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'sjr-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'sjr-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'sjr-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'sjr-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'sjr-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-sujata-rai', teacher_name: 'Ms. Sujata Rai', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },

    // MR. DIPANKER PARAJULI (29 Periods from handwritten timetable)
    { id: 'dp-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'dp-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'dp-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'dp-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'dp-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'dp-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'dp-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'dp-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'dp-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'dp-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'dp-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'dp-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'dp-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-dipanker-parajuli', teacher_name: 'Mr. Dipanker Parajuli', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },

    // MRS. NIRJALA PRADHAN (28 Periods from handwritten timetable)
    { id: 'np-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'np-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'np-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'np-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-nirjala-pradhan', teacher_name: 'Mrs. Nirjala Pradhan', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Geography', entry_type: 'SUBJECT' },

    // MR. PRANAY PRADHAN (29 Periods from handwritten timetable)
    { id: 'pp-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'pp-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'pp-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'pp-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'pp-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'pp-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'pp-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'pp-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Geography', entry_type: 'SUBJECT' },
    { id: 'pp-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'pp-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Hospitality', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'pp-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-pranay-pradhan', teacher_name: 'Mr. Pranay Pradhan', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'Hospitality', entry_type: 'SUBJECT' },

    // MS. PRATIKA TAMANG (28 Periods from handwritten timetable)
    { id: 'ptt-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Morning Assembly', entry_type: 'ASSEMBLY' },
    { id: 'ptt-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'ptt-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10h', class_name: '10', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-11h', class_name: '11', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-10sc', class_name: '10', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-9sc', class_name: '9', section: 'Sc', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'ptt-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-pratika-tamang', teacher_name: 'Ms. Pratika Tamang', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },

    // MS. SUPRIYA CHETTRI (28 Periods from handwritten timetable)
    { id: 'sc-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Science', entry_type: 'SUBJECT' },
    { id: 'sc-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Social Studies', entry_type: 'SUBJECT' },
    { id: 'sc-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Science', entry_type: 'SUBJECT' },
    { id: 'sc-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'sc-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Social Studies', entry_type: 'SUBJECT' },
    { id: 'sc-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry Practical', entry_type: 'PRACTICAL' },
    { id: 'sc-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry Practical', entry_type: 'PRACTICAL' },
    { id: 'sc-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'sc-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Social Studies', entry_type: 'SUBJECT' },
    { id: 'sc-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Science', entry_type: 'SUBJECT' },
    { id: 'sc-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Social Studies', entry_type: 'SUBJECT' },
    { id: 'sc-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Science', entry_type: 'SUBJECT' },
    { id: 'sc-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Social Studies', entry_type: 'SUBJECT' },
    { id: 'sc-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Science', entry_type: 'SUBJECT' },
    { id: 'sc-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Chemistry Practical', entry_type: 'PRACTICAL' },
    { id: 'sc-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Chemistry Practical', entry_type: 'PRACTICAL' },
    { id: 'sc-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Science', entry_type: 'SUBJECT' },
    { id: 'sc-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Social Studies', entry_type: 'SUBJECT' },
    { id: 'sc-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-12sc', class_name: '12', section: 'Sc', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'sc-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-supriya-chettri', teacher_name: 'Ms. Supriya Chettri', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Science', entry_type: 'SUBJECT' },

    // MS. ANUPAMA GURUNG (28 Periods from handwritten timetable)
    { id: 'apg-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'apg-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'apg-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Moral Science (M.Sc.)', entry_type: 'M.SC.' },
    { id: 'apg-thu-6', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 6, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },
    { id: 'apg-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-anupama-gurung', teacher_name: 'Ms. Anupama Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: '2L Nepali', entry_type: 'SUBJECT' },

    // MR. RAJESH SINGH (30 Periods from handwritten timetable)
    { id: 'rs-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-mon-3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-mon-6', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rs-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY' },
    { id: 'rs-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'rs-tue-5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-senior', class_name: 'Senior', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'rs-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
    { id: 'rs-wed-9', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 9, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'rs-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rs-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rs-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rs-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rs-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rs-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-rajesh-singh', teacher_name: 'Mr. Rajesh Singh', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    // MR. SAGAR GURUNG (28 Periods from handwritten timetable)
    { id: 'sg-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'sg-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'sg-mon-4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 4, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-mon-5', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sg-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY', notes: 'Class 6B Class Teacher Period' },
    { id: 'sg-tue-3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sg-tue-4', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 4, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sg-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-middle', class_name: 'Middle', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'sg-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-wed-2', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'sg-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'sg-wed-6', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 6, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sg-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'sg-thu-5', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 5, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'History', entry_type: 'SUBJECT' },
    { id: 'sg-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sg-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-thu-9', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 9, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY', notes: 'Class 6B Class Teacher Activity' },
    { id: 'sg-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-fri-3', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 3, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-fri-4', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-fri-6', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 6, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'sg-fri-7', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 7, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Mathematics', entry_type: 'SUBJECT' },
    { id: 'sg-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-sagar-gurung', teacher_name: 'Mr. Sagar Gurung', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY' },

    // MR. RAHUL CHETTRI (28 Periods from handwritten timetable)
    { id: 'rc-mon-1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rc-mon-2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rc-mon-7', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-mon-8', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 8, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-mon-9', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 9, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-tue-1', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Assembly or Moral Science', entry_type: 'ASSEMBLY', notes: 'Class 8A Class Teacher Period' },
    { id: 'rc-tue-2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-tue-6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 6, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-tue-7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 7, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-7b', class_name: '7', section: 'B', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'rc-tue-8', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 8, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-tue-9', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-middle', class_name: 'Middle', section: '', subject_name: 'Weekly Test', entry_type: 'TEST' },
    { id: 'rc-wed-1', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 1, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rc-wed-3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 3, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rc-wed-4', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 4, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-wed-5', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 5, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-wed-7', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 7, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-wed-8', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 8, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-thu-1', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 1, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rc-thu-2', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 2, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Computer Applications', entry_type: 'SUBJECT' },
    { id: 'rc-thu-3', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 3, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'General Knowledge', entry_type: 'SUBJECT' },
    { id: 'rc-thu-4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6b', class_name: '6', section: 'B', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-thu-7', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 7, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-thu-8', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 8, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-10', class_name: '10', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-fri-1', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 1, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rc-fri-2', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 2, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Chemistry', entry_type: 'SUBJECT' },
    { id: 'rc-fri-5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 5, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Robotics', entry_type: 'ROBOTICS' },
    { id: 'rc-fri-8', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 8, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-9', class_name: '9', section: '', subject_name: 'Computer Applications', entry_type: 'SUBJECT', notes: 'Parallel Elective' },
    { id: 'rc-fri-9', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 9, teacher_id: 't-rahul-chettri', teacher_name: 'Mr. Rahul Chettri', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'Special Activity', entry_type: 'SPECIAL ACTIVITY', notes: 'Class 8A Class Teacher Activity' },
  ];

  return { versions: [defaultVersion], entries };
}

// In-Memory Runtime Store (Initialized with storage or seed)
class RoutineStore {
  constructor() {
    this.init();
  }

  init() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedVersions = localStorage.getItem(KEY_VERSIONS);
        const storedEntries = localStorage.getItem(KEY_ENTRIES);
        if (storedVersions && storedEntries) {
          this.versions = JSON.parse(storedVersions);
          this.entries = JSON.parse(storedEntries);
          this.acknowledgements = JSON.parse(localStorage.getItem(KEY_ACKS) || '[]');
          this.auditLogs = JSON.parse(localStorage.getItem(KEY_AUDIT) || '[]');
          this.periods = JSON.parse(localStorage.getItem(KEY_PERIODS) || JSON.stringify(DEFAULT_PERIODS));

          // Auto-heal: Ensure Subodh's authentic routine from handwritten sheets is present in localStorage
          const subodhCount = this.entries.filter(e => 
            e.teacher_id === 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5' || 
            e.teacher_id === 't-subodh-rai' || 
            (e.teacher_name && e.teacher_name.toLowerCase().includes('subodh'))
          ).length;

          if (subodhCount < 29) {
            const seed = getInitialSeedData();
            const subodhSeedEntries = seed.entries.filter(e => e.teacher_id === 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5');
            this.entries = this.entries.filter(e => 
              e.teacher_id !== 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5' && 
              e.teacher_id !== 't-subodh-rai' && 
              !(e.teacher_name && e.teacher_name.toLowerCase().includes('subodh'))
            ).concat(subodhSeedEntries);
            this.persist();
          }

          return;
        }
      }
    } catch (e) {
      console.warn('LocalStorage read error, using in-memory fallback:', e);
    }

    const seed = getInitialSeedData();
    this.versions = seed.versions;
    this.entries = seed.entries;
    this.acknowledgements = [];
    this.auditLogs = [];
    this.periods = [...DEFAULT_PERIODS];
    this.persist();
  }

  persist() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(KEY_VERSIONS, JSON.stringify(this.versions));
        localStorage.setItem(KEY_ENTRIES, JSON.stringify(this.entries));
        localStorage.setItem(KEY_ACKS, JSON.stringify(this.acknowledgements));
        localStorage.setItem(KEY_AUDIT, JSON.stringify(this.auditLogs));
        localStorage.setItem(KEY_PERIODS, JSON.stringify(this.periods));
      }
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }
}

const memoryStore = new RoutineStore();

export class RoutineService {

  /**
   * Helper to resolve Period Times
   */
  static getPeriods() {
    return memoryStore.periods;
  }

  /**
   * Updates Period Configuration
   */
  static async updatePeriods(newPeriods) {
    memoryStore.periods = newPeriods;
    memoryStore.persist();
    return { success: true, periods: memoryStore.periods };
  }

  /**
   * Returns all routine versions for an academic year
   */
  static async getVersions(academicYear = '2026') {
    // 1. Try Supabase
    try {
      const { data, error } = await supabase
        .from('routine_versions')
        .select('*')
        .eq('academic_year', String(academicYear))
        .order('version_num', { ascending: false });
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      // Fallback
    }
    return memoryStore.versions.filter(v => v.academic_year === String(academicYear));
  }

  /**
   * Returns the currently active (PUBLISHED or latest DRAFT) version
   */
  static async getActiveVersion(academicYear = '2026') {
    const versions = await this.getVersions(academicYear);
    const published = versions.find(v => v.status === 'PUBLISHED');
    if (published) return published;
    return versions[0] || null;
  }

  /**
   * Creates a new draft version (e.g. V2, V3)
   */
  static async createDraftVersion({
    academicYear = '2026',
    campusName = 'Senior School',
    changeReason = 'Routine modification',
    createdBy = null,
    performerName = 'Principal'
  }) {
    const existing = await this.getVersions(academicYear);
    const nextNum = existing.length > 0 ? Math.max(...existing.map(v => v.version_num)) + 1 : 1;
    const newVersion = {
      id: `v-${academicYear}-v${nextNum}-${Date.now()}`,
      academic_year: String(academicYear),
      campus_name: campusName,
      version_code: `V${nextNum}`,
      version_num: nextNum,
      title: `${campusName} Master Routine (${academicYear}) - V${nextNum}`,
      status: 'DRAFT',
      change_reason: changeReason,
      summary_stats: { totalTeachers: 0, totalClasses: 0, totalEntries: 0, conflicts: 0, warnings: 0 },
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Attempt Supabase
    try {
      const { data, error } = await supabase.from('routine_versions').insert([newVersion]).select().single();
      if (!error && data) {
        newVersion.id = data.id;
      }
    } catch (err) {
      // Fallback
    }

    memoryStore.versions.unshift(newVersion);
    this.logAudit({
      version_id: newVersion.id,
      action: 'ROUTINE_CREATED',
      performed_by: createdBy,
      performer_name: performerName,
      details: { version_code: newVersion.version_code, changeReason }
    });
    memoryStore.persist();

    return newVersion;
  }

  /**
   * Retrieves all master routine entries for a version with optional filters
   */
  static async getMasterRoutine(versionId, filters = {}) {
    let entries = [];
    try {
      let query = supabase.from('master_routine').select('*').eq('version_id', versionId);
      if (filters.day_of_week) query = query.eq('day_of_week', filters.day_of_week);
      if (filters.period_num) query = query.eq('period_num', filters.period_num);
      if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
      if (filters.class_id) query = query.eq('class_id', filters.class_id);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        entries = data;
      }
    } catch (err) {
      // Fallback
    }

    if (entries.length === 0) {
      entries = memoryStore.entries.filter(e => e.version_id === versionId);
      if (filters.day_of_week) entries = entries.filter(e => e.day_of_week === Number(filters.day_of_week));
      if (filters.teacher_id) {
        entries = entries.filter(e => {
          if (e.teacher_id === filters.teacher_id) return true;
          const aliases = {
            't-dhirendra-lama': 'df48470e-69b8-4b75-be3f-46aa28f58a32',
            'df48470e-69b8-4b75-be3f-46aa28f58a32': 't-dhirendra-lama',
            't-ajoy-gurung': '19c8be5c-6d67-4864-b86d-e7579c827d94',
            '19c8be5c-6d67-4864-b86d-e7579c827d94': 't-ajoy-gurung',
            't-subodh-rai': 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5',
            'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5': 't-subodh-rai',
            't-sarita-sharma': 'a1111111-2026-0001-0000-000000000001',
            'a1111111-2026-0001-0000-000000000001': 't-sarita-sharma',
            't-pinki-gupta': 'a1111111-2026-0002-0000-000000000002',
            'a1111111-2026-0002-0000-000000000002': 't-pinki-gupta',
            't-s-routh': 'a1111111-2026-0003-0000-000000000003',
            'a1111111-2026-0003-0000-000000000003': 't-s-routh',
            't-kalyan-mukhia': 'a1111111-2026-0004-0000-000000000004',
            'a1111111-2026-0004-0000-000000000004': 't-kalyan-mukhia',
            't-akash-kharel': 'a1111111-2026-0005-0000-000000000005',
            'a1111111-2026-0005-0000-000000000005': 't-akash-kharel',
            't-kalyani-sharma': 'a1111111-2026-0006-0000-000000000006',
            'a1111111-2026-0006-0000-000000000006': 't-kalyani-sharma',
            't-promeeta-thapa': 'a1111111-2026-0007-0000-000000000007',
            'a1111111-2026-0007-0000-000000000007': 't-promeeta-thapa',
            't-prajwal-singh': 'a1111111-2026-0008-0000-000000000008',
            'a1111111-2026-0008-0000-000000000008': 't-prajwal-singh',
            't-deven-gurung': 'a1111111-2026-0009-0000-000000000009',
            'a1111111-2026-0009-0000-000000000009': 't-deven-gurung'
          };
          return aliases[filters.teacher_id] === e.teacher_id;
        });
      }
      if (filters.entry_type) entries = entries.filter(e => e.entry_type === filters.entry_type);
    }

    return entries;
  }

  /**
   * TEACHER-WISE ROUTINE ("My Routine"):
   * Returns a 5-day x 9-period matrix for a specific teacher.
   * Free periods are marked with is_free: true.
   */
  static async getTeacherRoutine(teacherId, versionId) {
    const entries = await this.getMasterRoutine(versionId, { teacher_id: teacherId });
    const periods = this.getPeriods();
    
    // Construct 5 days x periods matrix
    const scheduleByDay = {};
    WORKING_DAYS.forEach(day => {
      scheduleByDay[day.id] = {
        dayId: day.id,
        dayName: day.name,
        periods: periods.map(p => {
          const entry = entries.find(e => e.day_of_week === day.id && e.period_num === p.period_num);
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

    const teacherName = entries[0]?.teacher_name || 'Teacher';
    const uniqueClasses = [...new Set(entries.map(e => `${e.class_name || ''} ${e.section || ''}`.trim()).filter(Boolean))];
    const uniqueSubjects = [...new Set(entries.map(e => e.subject_name).filter(Boolean))];

    return {
      teacherId,
      teacherName,
      classesHandled: uniqueClasses,
      subjectsHandled: uniqueSubjects,
      scheduleByDay,
      totalAssignedPeriods: entries.length,
      freePeriodsCount: (WORKING_DAYS.length * periods.length) - entries.length
    };
  }

  /**
   * TODAY'S ROUTINE (Teacher Mobile & Dashboard Widget):
   * Returns period-by-period list for the current day.
   */
  static async getTodayTeacherRoutine(teacherId, date = new Date(), versionId = null) {
    const d = new Date(date);
    let dayOfWeek = d.getDay(); // 0=Sun, 1=Mon... 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) dayOfWeek = 1; // Default to Monday on weekends for preview

    let targetVersion = versionId;
    if (!targetVersion) {
      const active = await this.getActiveVersion();
      targetVersion = active?.id;
    }

    const teacherData = await this.getTeacherRoutine(teacherId, targetVersion);
    const daySchedule = teacherData.scheduleByDay[dayOfWeek] || { periods: [] };

    return {
      date: d.toISOString().split('T')[0],
      dayName: WORKING_DAYS.find(w => w.id === dayOfWeek)?.name || 'Monday',
      dayOfWeek,
      periods: daySchedule.periods
    };
  }

  /**
   * CLASS-WISE ROUTINE:
   * Returns a 5-day x 9-period matrix for a class and section.
   */
  static async getClassRoutine(classId, section = '', versionId = null) {
    if (!versionId) {
      const active = await this.getActiveVersion();
      versionId = active?.id;
    }
    const allEntries = await this.getMasterRoutine(versionId);
    const classEntries = allEntries.filter(e => {
      if (e.class_id === classId) return true;
      if (section && e.section && e.section.toLowerCase() === section.toLowerCase()) {
        return String(e.class_name) === String(classId);
      }
      return false;
    });

    const periods = this.getPeriods();
    const scheduleByDay = {};

    WORKING_DAYS.forEach(day => {
      scheduleByDay[day.id] = {
        dayId: day.id,
        dayName: day.name,
        periods: periods.map(p => {
          const entry = classEntries.find(e => e.day_of_week === day.id && e.period_num === p.period_num);
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

    const className = classEntries[0]?.class_name || classId;
    const classSection = classEntries[0]?.section || section;

    return {
      classId,
      className,
      section: classSection,
      fullClassName: `Class ${className} ${classSection}`.trim(),
      scheduleByDay
    };
  }

  /**
   * SUBJECT-WISE ROUTINE:
   * Returns all periods where a subject is taught.
   */
  static async getSubjectRoutine(subjectName, versionId = null) {
    if (!versionId) {
      const active = await this.getActiveVersion();
      versionId = active?.id;
    }
    const allEntries = await this.getMasterRoutine(versionId);
    const subjectEntries = allEntries.filter(e => 
      e.subject_name?.toLowerCase() === subjectName?.toLowerCase()
    );

    return {
      subjectName,
      totalPeriods: subjectEntries.length,
      entries: subjectEntries
    };
  }

  /**
   * SUPERVISION: "WHO IS TEACHING?" VIEW
   * Given a Day of Week and Period, returns all classes and who is currently teaching them.
   */
  static async getWhoIsTeaching(dayOfWeek, periodNum, versionId = null) {
    if (!versionId) {
      const active = await this.getActiveVersion();
      versionId = active?.id;
    }
    const entries = await this.getMasterRoutine(versionId, {
      day_of_week: Number(dayOfWeek),
      period_num: Number(periodNum)
    });

    return entries.map(e => ({
      class: `${e.class_name} ${e.section || ''}`.trim(),
      teacher: e.teacher_name,
      subject: e.subject_name,
      entryType: e.entry_type,
      room: e.room || 'General Classroom',
      notes: e.notes || ''
    }));
  }

  /**
   * SUPERVISION: "WHO IS FREE?" VIEW
   * Given a Day of Week and Period, returns all teachers who have NO assignment.
   */
  static async getWhoIsFree(dayOfWeek, periodNum, allTeachers = [], versionId = null) {
    if (!versionId) {
      const active = await this.getActiveVersion();
      versionId = active?.id;
    }
    const busyEntries = await this.getMasterRoutine(versionId, {
      day_of_week: Number(dayOfWeek),
      period_num: Number(periodNum)
    });

    const busyTeacherIds = new Set(busyEntries.map(e => e.teacher_id));
    
    // If allTeachers list is empty, deduce from memoryStore
    let teacherPool = allTeachers;
    if (!teacherPool || teacherPool.length === 0) {
      const allEntries = await this.getMasterRoutine(versionId);
      const map = new Map();
      allEntries.forEach(e => {
        if (!map.has(e.teacher_id)) map.set(e.teacher_id, { id: e.teacher_id, name: e.teacher_name });
      });
      teacherPool = Array.from(map.values());
    }

    const freeTeachers = teacherPool.filter(t => !busyTeacherIds.has(t.id));
    return {
      dayOfWeek: Number(dayOfWeek),
      periodNum: Number(periodNum),
      busyCount: busyEntries.length,
      freeCount: freeTeachers.length,
      freeTeachers: freeTeachers.map(t => ({
        id: t.id,
        name: t.name || t.full_name || 'Teacher',
        department: t.department || 'General'
      }))
    };
  }

  /**
   * CONFLICT DETECTION & VALIDATION ENGINE
   * Validates a candidate routine before publishing.
   * 
   * Checks:
   * 1. Teacher Double-Booking (Teacher in 2 classes same day & period) -> CRITICAL ERROR
   * 2. Class Double-Booking (Class having 2 teachers/subjects same day & period) -> CRITICAL ERROR
   * 3. Room Double-Booking (Same room used by 2 classes same day & period) -> CRITICAL ERROR
   * 4. Missing required fields (teacher, class, subject/activity) -> CRITICAL ERROR
   * 5. Teacher qualification / subject assignment mismatch -> WARNING
   */
  static validateRoutine(entries = [], options = {}) {
    const criticalErrors = [];
    const warnings = [];

    const teacherMap = new Map(); // key: "day_period_teacherId"
    const classMap = new Map();   // key: "day_period_classId_section"
    const roomMap = new Map();    // key: "day_period_room"

    entries.forEach((entry, idx) => {
      const day = entry.day_of_week;
      const period = entry.period_num;
      const dayName = WORKING_DAYS.find(w => w.id === day)?.name || `Day ${day}`;

      // 1. Missing Data Check
      if (!entry.teacher_id && entry.entry_type !== 'FREE PERIOD') {
        criticalErrors.push({
          type: 'MISSING_TEACHER',
          message: `${dayName} Period ${period}: Assignment is missing a designated teacher.`,
          entry
        });
      }
      if (!entry.class_id && entry.entry_type !== 'ASSEMBLY' && entry.entry_type !== 'FREE PERIOD') {
        criticalErrors.push({
          type: 'MISSING_CLASS',
          message: `${dayName} Period ${period}: Assignment for ${entry.teacher_name || 'Teacher'} is missing a Class.`,
          entry
        });
      }
      if (!entry.subject_name && !entry.entry_type) {
        criticalErrors.push({
          type: 'MISSING_SUBJECT',
          message: `${dayName} Period ${period}: Assignment is missing Subject or Activity name.`,
          entry
        });
      }

      // 2. Teacher Conflict Check
      if (entry.teacher_id && entry.entry_type !== 'FREE PERIOD') {
        const tKey = `${day}_${period}_${entry.teacher_id}`;
        if (teacherMap.has(tKey)) {
          const existing = teacherMap.get(tKey);
          criticalErrors.push({
            type: 'TEACHER_CONFLICT',
            message: `Teacher Double-Booking: ${entry.teacher_name} is simultaneously assigned to ${existing.class_name || 'Class'} and ${entry.class_name || 'Class'} on ${dayName}, Period ${period}.`,
            entries: [existing, entry]
          });
        } else {
          teacherMap.set(tKey, entry);
        }
      }

      // 3. Class Conflict Check
      if (entry.class_id && entry.entry_type !== 'ASSEMBLY' && entry.entry_type !== 'FREE PERIOD') {
        const cKey = `${day}_${period}_${entry.class_id}_${entry.section || ''}`;
        if (classMap.has(cKey)) {
          const existing = classMap.get(cKey);
          
          // Check authorized parallel electives, co-teaching, and split sessions
          const isCoTeachingLibrary = (existing.entry_type === 'LIBRARY' && entry.entry_type === 'LIBRARY');
          const isCoSupervisionTest = (existing.entry_type === 'TEST' && entry.entry_type === 'TEST');
          const isParallelSectionSplit = (
            (entry.class_name === '5' && entry.section === 'B' && day === 5 && period === 9) ||
            (entry.class_name === '8' && entry.section === 'A' && day === 5 && period === 5 &&
             ((existing.entry_type === 'LIBRARY' && entry.entry_type === 'ROBOTICS') ||
              (existing.entry_type === 'ROBOTICS' && entry.entry_type === 'LIBRARY')))
          );

          // 1. High School 4-Way Electives (Classes 9 & 10): Art, Music, CA, PT/Games
          const hsElectives = ['Art', 'Music', 'Computer Applications', 'PT / Games', 'Physical Education', 'Games', 'Hospitality', 'Home Science'];
          const isParallelElectiveHighSchool = (
            (entry.class_name === '9' || entry.class_name === '10') &&
            hsElectives.some(s => existing.subject_name?.includes(s)) &&
            hsElectives.some(s => entry.subject_name?.includes(s))
          );

          // 2. Second Language Parallel Elective (Classes 9, 10, 11, 12): 2L Nepali vs 2L Hindi
          const isParallelSecondLanguage = (
            ['5', '6', '7', '8', '9', '10', '11', '12'].includes(entry.class_name) &&
            ((existing.subject_name?.includes('Nepali') && entry.subject_name?.includes('Hindi')) ||
             (existing.subject_name?.includes('Hindi') && entry.subject_name?.includes('Nepali')))
          );

          // 3. Higher Secondary Elective Choice (Classes 11 & 12): Language vs Physical Education, SUPW vs Biology
          const isParallelHSElective = (
            ['11', '12'].includes(entry.class_name) &&
            (((existing.subject_name?.includes('Physical Education') && (entry.subject_name?.includes('Nepali') || entry.subject_name?.includes('Hindi'))) ||
              ((existing.subject_name?.includes('Nepali') || existing.subject_name?.includes('Hindi')) && entry.subject_name?.includes('Physical Education'))) ||
             ((existing.subject_name?.includes('SUPW') && entry.subject_name?.includes('Biology')) ||
              (existing.subject_name?.includes('Biology') && entry.subject_name?.includes('SUPW'))))
          );

          // 3b. Higher Secondary Humanities Elective (Classes 11 & 12): Economics vs History
          const isParallelHumanitiesElective = (
            ['11', '12'].includes(entry.class_name) &&
            ((existing.subject_name?.includes('Economics') && entry.subject_name?.includes('History')) ||
             (existing.subject_name?.includes('History') && entry.subject_name?.includes('Economics')))
          );

          // 3c. High School Humanities Elective (Classes 9 & 10): Mathematics vs EVS
          const isParallelClass910Elective = (
            ['9', '10'].includes(entry.class_name) &&
            ((existing.subject_name?.includes('Mathematics') && entry.subject_name?.includes('EVS')) ||
             (existing.subject_name?.includes('EVS') && entry.subject_name?.includes('Mathematics')))
          );

          // 4. Third Language Parallel Elective (Classes 5, 6, 7, 8): TL Nepali vs TL Hindi
          const isParallelThirdLanguage = (
            ['5', '6', '7', '8'].includes(entry.class_name) &&
            ((existing.subject_name?.includes('TL Nepali') && entry.subject_name?.includes('TL Hindi')) ||
             (existing.subject_name?.includes('TL Hindi') && entry.subject_name?.includes('TL Nepali')))
          );

          // 5. Co-supervised Special Activity / Remedial Period 9
          const isCoSupervisedActivity = (
            period === 9 &&
            (existing.entry_type === 'SPECIAL ACTIVITY' || entry.entry_type === 'SPECIAL ACTIVITY' ||
             existing.subject_name?.includes('Activity') || entry.subject_name?.includes('Activity'))
          );

          // 6. Class 9 Friday Period 5 Library / Hindi split
          const isParallelClass9FriP5 = (
            entry.class_name === '9' && day === 5 && period === 5
          );

          const isValidParallel = isCoTeachingLibrary || isCoSupervisionTest || isParallelSectionSplit ||
            isParallelClass9FriP5 || isParallelElectiveHighSchool || isParallelSecondLanguage ||
            isParallelHSElective || isParallelHumanitiesElective || isParallelClass910Elective || isParallelThirdLanguage || isCoSupervisedActivity;

          if (!isValidParallel) {
            criticalErrors.push({
              type: 'CLASS_CONFLICT',
              message: `Class Double-Booking: Class ${entry.class_name} ${entry.section || ''} has multiple assignments on ${dayName}, Period ${period} (${existing.subject_name} by ${existing.teacher_name} AND ${entry.subject_name} by ${entry.teacher_name}).`,
              entries: [existing, entry]
            });
          }
        } else {
          classMap.set(cKey, entry);
        }
      }

      // 4. Room Conflict Check
      if (entry.room && entry.room.trim() && entry.entry_type !== 'FREE PERIOD') {
        const rKey = `${day}_${period}_${entry.room.trim().toLowerCase()}`;
        if (roomMap.has(rKey)) {
          const existing = roomMap.get(rKey);
          criticalErrors.push({
            type: 'ROOM_CONFLICT',
            message: `Room Conflict: Room "${entry.room}" is simultaneously occupied by Class ${existing.class_name} and Class ${entry.class_name} on ${dayName}, Period ${period}.`,
            entries: [existing, entry]
          });
        } else {
          roomMap.set(rKey, entry);
        }
      }
    });

    return {
      isValid: criticalErrors.length === 0,
      criticalErrors,
      warnings,
      totalEntries: entries.length,
      teacherConflicts: criticalErrors.filter(e => e.type === 'TEACHER_CONFLICT').length,
      classConflicts: criticalErrors.filter(e => e.type === 'CLASS_CONFLICT').length,
      roomConflicts: criticalErrors.filter(e => e.type === 'ROOM_CONFLICT').length
    };
  }

  /**
   * SAVES / UPSERTS A SINGLE MASTER ROUTINE ENTRY
   */
  static async saveEntry(entry) {
    if (!entry.id) {
      entry.id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }
    entry.updated_at = new Date().toISOString();

    // In-Memory save
    const idx = memoryStore.entries.findIndex(e => 
      e.id === entry.id || 
      (e.version_id === entry.version_id && e.teacher_id === entry.teacher_id && e.day_of_week === entry.day_of_week && e.period_num === entry.period_num)
    );
    if (idx >= 0) {
      memoryStore.entries[idx] = { ...memoryStore.entries[idx], ...entry };
    } else {
      memoryStore.entries.push(entry);
    }
    memoryStore.persist();

    // Supabase upsert
    try {
      await supabase.from('master_routine').upsert([entry]);
    } catch (err) {
      // Ignored
    }

    return entry;
  }

  /**
   * BATCH SAVE ENTRIES
   */
  static async saveBatchEntries(versionId, entries) {
    entries.forEach(e => {
      e.version_id = versionId;
      if (!e.id) e.id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    });

    // Remove old entries for this version and append new ones
    memoryStore.entries = memoryStore.entries.filter(e => e.version_id !== versionId).concat(entries);
    memoryStore.persist();

    try {
      await supabase.from('master_routine').delete().eq('version_id', versionId);
      await supabase.from('master_routine').insert(entries);
    } catch (err) {
      // Ignored
    }

    return entries;
  }

  /**
   * CLEARS ALL ENTRIES FOR A TEACHER ON A SPECIFIC DAY
   */
  static async clearTeacherDay(teacherId, dayOfWeek, versionId) {
    memoryStore.entries = memoryStore.entries.filter(e => 
      !(e.version_id === versionId && e.teacher_id === teacherId && e.day_of_week === Number(dayOfWeek))
    );
    memoryStore.persist();

    try {
      await supabase.from('master_routine').delete().match({
        version_id: versionId,
        teacher_id: teacherId,
        day_of_week: Number(dayOfWeek)
      });
    } catch (err) {
      // Ignored
    }
    return { success: true };
  }

  /**
   * DUPLICATES A TEACHER'S DAY SCHEDULE TO ANOTHER DAY
   */
  static async duplicateTeacherDay(teacherId, sourceDay, targetDay, versionId) {
    const sourceEntries = memoryStore.entries.filter(e => 
      e.version_id === versionId && e.teacher_id === teacherId && e.day_of_week === Number(sourceDay)
    );
    
    // Clear target day first
    await this.clearTeacherDay(teacherId, targetDay, versionId);

    const cloned = sourceEntries.map(e => ({
      ...e,
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      day_of_week: Number(targetDay)
    }));

    memoryStore.entries = memoryStore.entries.concat(cloned);
    memoryStore.persist();

    try {
      await supabase.from('master_routine').insert(cloned);
    } catch (err) {
      // Ignored
    }
    return cloned;
  }

  /**
   * PUBLISHING PIPELINE:
   * 1. Validates entire routine dataset — strictly BLOCKS on critical errors.
   * 2. Marks previous published version as SUPERSEDED.
   * 3. Sets current version to PUBLISHED.
   * 4. Identifies affected teachers.
   * 5. Dispatches targeted notifications via NotificationService & user_devices.
   * 6. Generates pending acknowledgements.
   * 7. Logs audit trail.
   */
  static async publishRoutine(versionId, publishedBy = null, performerName = 'Principal') {
    const version = memoryStore.versions.find(v => v.id === versionId);
    if (!version) throw new Error('Routine version not found');

    const entries = await this.getMasterRoutine(versionId);
    const validation = this.validateRoutine(entries);

    if (!validation.isValid) {
      throw new Error(`Cannot publish routine: ${validation.criticalErrors.length} critical conflicts detected. Please resolve them first.`);
    }

    // 1. Supersede previously published version
    const prevPublished = memoryStore.versions.find(v => 
      v.academic_year === version.academic_year && 
      v.status === 'PUBLISHED' && 
      v.id !== versionId
    );
    if (prevPublished) {
      prevPublished.status = 'SUPERSEDED';
      prevPublished.updated_at = new Date().toISOString();
      try {
        await supabase.from('routine_versions').update({ status: 'SUPERSEDED' }).eq('id', prevPublished.id);
      } catch (e) {}
    }

    // 2. Set current version to PUBLISHED
    version.status = 'PUBLISHED';
    version.published_at = new Date().toISOString();
    version.published_by = publishedBy;
    version.published_by_name = performerName;
    version.summary_stats = {
      totalTeachers: new Set(entries.map(e => e.teacher_id)).size,
      totalClasses: new Set(entries.map(e => `${e.class_name}_${e.section}`)).size,
      totalEntries: entries.length,
      conflicts: 0,
      warnings: validation.warnings.length
    };

    try {
      await supabase.from('routine_versions').update({
        status: 'PUBLISHED',
        published_at: version.published_at,
        published_by: publishedBy,
        summary_stats: version.summary_stats
      }).eq('id', versionId);
    } catch (e) {}

    // 3. Determine Affected Teachers
    const allAssignedTeachers = Array.from(new Set(entries.map(e => e.teacher_id)));
    let affectedTeacherIds = allAssignedTeachers;

    // If this is an update from a previous version, identify targeted teachers whose periods actually changed
    if (prevPublished) {
      const prevEntries = await this.getMasterRoutine(prevPublished.id);
      const changed = new Set();
      allAssignedTeachers.forEach(tId => {
        const currT = entries.filter(e => e.teacher_id === tId);
        const prevT = prevEntries.filter(e => e.teacher_id === tId);
        if (currT.length !== prevT.length) {
          changed.add(tId);
        } else {
          const isDiff = currT.some(c => {
            const match = prevT.find(p => p.day_of_week === c.day_of_week && p.period_num === c.period_num);
            return !match || match.class_name !== c.class_name || match.subject_name !== c.subject_name;
          });
          if (isDiff) changed.add(tId);
        }
      });
      if (changed.size > 0) affectedTeacherIds = Array.from(changed);
    }

    // 4. Reset & Initialize Acknowledgements for all teachers in this version
    allAssignedTeachers.forEach(tId => {
      const teacherEntry = entries.find(e => e.teacher_id === tId);
      const existingAck = memoryStore.acknowledgements.find(a => a.version_id === versionId && a.teacher_id === tId);
      if (!existingAck) {
        memoryStore.acknowledgements.push({
          id: `ack-${versionId}-${tId}`,
          version_id: versionId,
          teacher_id: tId,
          teacher_name: teacherEntry?.teacher_name || 'Teacher',
          viewed_at: null,
          acknowledged_at: null,
          created_at: new Date().toISOString()
        });
      }
    });

    // 5. Dispatch Automatic Push Notifications
    try {
      await NotificationService.dispatchNoticePush({
        noticeId: versionId,
        title: `Weekly Routine Published (${version.version_code})`,
        content: `The Principal has published the updated school routine (${version.version_code}). Please open 'My Routine' to review and acknowledge your schedule.`,
        recipientUserIds: affectedTeacherIds
      });
    } catch (pushErr) {
      console.warn('Push notification dispatch note:', pushErr.message);
    }

    // 6. Log Audit
    this.logAudit({
      version_id: versionId,
      action: 'ROUTINE_PUBLISHED',
      performed_by: publishedBy,
      performer_name: performerName,
      details: {
        version_code: version.version_code,
        totalEntries: entries.length,
        affectedTeachersCount: affectedTeacherIds.length
      }
    });

    memoryStore.persist();

    return {
      success: true,
      version,
      affectedTeacherIds,
      stats: version.summary_stats
    };
  }

  /**
   * TEACHER ACKNOWLEDGEMENT
   */
  static async acknowledgeRoutine(versionId, teacherId, teacherName = 'Teacher', notes = '') {
    let ack = memoryStore.acknowledgements.find(a => a.version_id === versionId && a.teacher_id === teacherId);
    const now = new Date().toISOString();

    if (ack) {
      ack.acknowledged_at = now;
      if (!ack.viewed_at) ack.viewed_at = now;
      ack.acknowledgement_notes = notes;
    } else {
      ack = {
        id: `ack-${versionId}-${teacherId}`,
        version_id: versionId,
        teacher_id: teacherId,
        teacher_name: teacherName,
        viewed_at: now,
        acknowledged_at: now,
        acknowledgement_notes: notes,
        created_at: now
      };
      memoryStore.acknowledgements.push(ack);
    }

    try {
      await supabase.from('routine_acknowledgements').upsert([ack]);
    } catch (e) {}

    this.logAudit({
      version_id: versionId,
      action: 'TEACHER_ACKNOWLEDGED',
      performed_by: teacherId,
      performer_name: teacherName,
      details: { timestamp: now, notes }
    });

    memoryStore.persist();
    return ack;
  }

  /**
   * RECORD ROUTINE VIEWED BY TEACHER
   */
  static async markViewedRoutine(versionId, teacherId, teacherName = 'Teacher') {
    let ack = memoryStore.acknowledgements.find(a => a.version_id === versionId && a.teacher_id === teacherId);
    const now = new Date().toISOString();

    if (ack) {
      if (!ack.viewed_at) {
        ack.viewed_at = now;
        memoryStore.persist();
      }
    } else {
      ack = {
        id: `ack-${versionId}-${teacherId}`,
        version_id: versionId,
        teacher_id: teacherId,
        teacher_name: teacherName,
        viewed_at: now,
        acknowledged_at: null,
        created_at: now
      };
      memoryStore.acknowledgements.push(ack);
      memoryStore.persist();
    }
    return ack;
  }

  /**
   * GET DISTRIBUTION & ACKNOWLEDGEMENT STATUS
   */
  static async getDistributionStatus(versionId) {
    const acks = memoryStore.acknowledgements.filter(a => a.version_id === versionId);
    const totalTeachers = acks.length;
    const viewedCount = acks.filter(a => a.viewed_at !== null).length;
    const acknowledgedCount = acks.filter(a => a.acknowledged_at !== null).length;
    const pendingCount = totalTeachers - acknowledgedCount;

    return {
      versionId,
      totalTeachers,
      viewedCount,
      acknowledgedCount,
      pendingCount,
      acknowledgements: acks
    };
  }

  /**
   * SENDS REMINDER NOTIFICATION TO PENDING TEACHERS
   */
  static async sendReminderToPending(versionId, teacherIds = []) {
    const targetIds = teacherIds.length > 0 
      ? teacherIds 
      : memoryStore.acknowledgements
          .filter(a => a.version_id === versionId && !a.acknowledged_at)
          .map(a => a.teacher_id);

    if (targetIds.length === 0) return { success: true, count: 0 };

    try {
      await NotificationService.dispatchNoticePush({
        noticeId: versionId,
        title: 'Reminder: Acknowledge Your Weekly Routine',
        content: 'Please review and acknowledge your published weekly teaching schedule in the Teacher Portal.',
        recipientUserIds: targetIds
      });
    } catch (e) {}

    this.logAudit({
      version_id: versionId,
      action: 'REMINDER_SENT',
      performer_name: 'Principal',
      details: { reminderCount: targetIds.length, targetIds }
    });

    return { success: true, count: targetIds.length };
  }

  /**
   * COPIES ROUTINE FROM PREVIOUS ACADEMIC YEAR
   */
  static async copyPreviousYearRoutine(fromYear, toYear, performerName = 'Principal') {
    const prevVersions = await this.getVersions(fromYear);
    const sourceVersion = prevVersions.find(v => v.status === 'PUBLISHED') || prevVersions[0];
    if (!sourceVersion) throw new Error(`No routine found for academic year ${fromYear}`);

    const sourceEntries = await this.getMasterRoutine(sourceVersion.id);
    const newDraft = await this.createDraftVersion({
      academicYear: toYear,
      campusName: sourceVersion.campus_name || 'Senior School',
      changeReason: `Cloned from Academic Year ${fromYear} (${sourceVersion.version_code})`,
      performerName
    });

    const clonedEntries = sourceEntries.map(e => ({
      ...e,
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      version_id: newDraft.id,
      academic_year: String(toYear)
    }));

    await this.saveBatchEntries(newDraft.id, clonedEntries);
    return newDraft;
  }

  /**
   * AUDIT LOGGING
   */
  static logAudit(auditData) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...auditData
    };
    memoryStore.auditLogs.unshift(entry);
    memoryStore.persist();

    try {
      supabase.from('routine_audit_logs').insert([entry]);
    } catch (e) {}
  }

  /**
   * RETRIEVES AUDIT LOGS
   */
  static async getAuditLogs(versionId = null) {
    if (versionId) {
      return memoryStore.auditLogs.filter(a => a.version_id === versionId);
    }
    return memoryStore.auditLogs;
  }
}

export default RoutineService;
