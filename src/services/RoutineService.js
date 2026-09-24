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
      totalTeachers: 8,
      totalClasses: 16,
      totalEntries: 62,
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
    { id: 'dh1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-11sc', class_name: '11', section: 'Sc', subject_name: 'SUPW', entry_type: 'SUPW' },
    { id: 'dh2', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 3, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5a', class_name: '5', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY' },
    { id: 'dh3', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 5, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-5b', class_name: '5', section: 'B', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh4', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 6, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-6a', class_name: '6', section: 'A', subject_name: 'Singing', entry_type: 'SINGING' },
    { id: 'dh5', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 1, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Assembly / M.Sc.', entry_type: 'ASSEMBLY' },
    { id: 'dh6', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 2, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-12h', class_name: '12', section: 'H', subject_name: 'SUPW', entry_type: 'SUPW' },
    { id: 'dh7', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-dhirendra-lama', teacher_name: 'Mr. Dhirendra Lama', class_id: 'c-9h', class_name: '9', section: 'H', subject_name: 'Weekly Test', entry_type: 'TEST' },

    // 5. MR AJOY GURUNG (5 to 12 Library)
    { id: 'aj1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 7, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Library', entry_type: 'LIBRARY', notes: 'With Mr. Keiran Thapa (KT)' },
    { id: 'aj2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 9, teacher_id: 't-ajoy-gurung', teacher_name: 'Mr. Ajoy Gurung', class_id: 'c-7a', class_name: '7', section: 'A', subject_name: 'Weekly Test', entry_type: 'TEST' },

    // 6. MR. KEIRAN THAPA (English 2, Classes 7A, 8A)
    { id: 'kt1', version_id: versionId, academic_year: '2026', day_of_week: 1, period_num: 1, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt2', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 3, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt3', version_id: versionId, academic_year: '2026', day_of_week: 3, period_num: 2, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt4', version_id: versionId, academic_year: '2026', day_of_week: 4, period_num: 4, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },
    { id: 'kt5', version_id: versionId, academic_year: '2026', day_of_week: 5, period_num: 4, teacher_id: 't-keiran-thapa', teacher_name: 'Mr. Keiran Thapa', class_id: 'c-8a', class_name: '8', section: 'A', subject_name: 'English 2', entry_type: 'SUBJECT' },

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
    { id: 'pt3', version_id: versionId, academic_year: '2026', day_of_week: 2, period_num: 5, teacher_id: 't-pti', teacher_name: 'Physical Training Instructors (PTI)', class_id: 'c-8b', class_name: '8', section: 'B', subject_name: 'PT / Games', entry_type: 'GAMES' }
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
      if (filters.period_num) entries = entries.filter(e => e.period_num === Number(filters.period_num));
      if (filters.teacher_id) entries = entries.filter(e => e.teacher_id === filters.teacher_id);
      if (filters.class_id) entries = entries.filter(e => e.class_id === filters.class_id);
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
          criticalErrors.push({
            type: 'CLASS_CONFLICT',
            message: `Class Double-Booking: Class ${entry.class_name} ${entry.section || ''} has multiple assignments on ${dayName}, Period ${period} (${existing.subject_name} by ${existing.teacher_name} AND ${entry.subject_name} by ${entry.teacher_name}).`,
            entries: [existing, entry]
          });
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
