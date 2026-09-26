/**
 * scripts/seed_subodh_and_master_routine.cjs
 * 
 * Seeds the complete authentic routine for Mr. Subodh Rai (from handwritten timetable)
 * and all school faculty into both the live Supabase PostgreSQL database.
 */

const fetch = require('node-fetch');

const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const service = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.4HviqYnTKiRK-RJvWzgAAuaFiq8--foTrXQpl7HYMU4';
const baseUrl = 'https://grades.gyanodayniketan.cloud/rest/v1';

const VERSION_ID = 'c0000000-2026-0001-0000-000000000001';

const CLASS_MAP = {
  '5A': '0b3e3144-13b2-4582-84b3-84a228d42aab',
  '5B': '2b4d0ed5-f39f-4dc7-8ba3-a01630d40502',
  '6A': '3d7b2b11-3b98-4bc1-b079-fdeacee7ccc6',
  '6B': 'b582f34d-e0d7-4f76-a0af-fe3511a17edb',
  '7A': '0b240100-1dc3-4b67-9b17-f1ef05a8520d',
  '7B': '8314b919-c0c8-4aab-b064-7f1452465ad1',
  '8A': '1f65a9fa-f164-475e-a014-b0bb8a2f2140',
  '8B': 'ecedcb42-33a5-4066-bbb8-7df2773b8bed',
  '9H': '8409c859-3acb-44b1-afa8-a6df3d1094a0',
  '9Sc': 'a7ca29de-75cb-40e1-91bb-d7b9b109a34f',
  '10H': 'd61882c2-3dcc-4dd7-ae29-bfe80e367030',
  '10Sc': 'f34cdeee-eafa-463b-a826-76be0ec4252d',
  '11H': '0acaaced-74e0-4e89-8e11-722ec03cdd64',
  '11Sc': '5a821184-7e83-4d91-b102-a79f79064cca',
  '12H': '9963070a-2640-490c-8f4e-3522b84df10d',
  '12Sc': '104a8a33-71f8-40ea-8d1e-62bd3193ed5d',
  '9': '8409c859-3acb-44b1-afa8-a6df3d1094a0',
  '10': 'd61882c2-3dcc-4dd7-ae29-bfe80e367030',
  '11': '0acaaced-74e0-4e89-8e11-722ec03cdd64',
  '12': '9963070a-2640-490c-8f4e-3522b84df10d',
  'All': '0b240100-1dc3-4b67-9b17-f1ef05a8520d',
  'Senior': '8409c859-3acb-44b1-afa8-a6df3d1094a0',
  'Middle': '0b240100-1dc3-4b67-9b17-f1ef05a8520d',
  'Junior': '0b3e3144-13b2-4582-84b3-84a228d42aab'
};

const TEACHER_MAP = {
  'Subodh': 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5',
  'Pinki BK': 'f0e6046b-c8e0-4a02-bdfc-dbbca4d9a11d',
  'Dipika Chettri': 'c67e3207-943a-463c-a691-e8d418c22a9e',
  'Sashank Lama': 'ddf9bd21-8576-4777-b25d-7fa8c78ceccd',
  'Dhirendra Lama': 'df48470e-69b8-4b75-be3f-46aa28f58a32',
  'Ajoy Gurung': '19c8be5c-6d67-4864-b86d-e7579c827d94',
  'Keiran Thapa': '3ee2cf65-5cd5-4338-9a02-091de8093351',
  'Rakesh Rai': '146560d1-b86f-4c78-92ac-c54fcde1c6e9',
  'Physical Training Instructors (PTI)': '1a0a2998-da0e-4ad5-9505-1514b423825d',
  'Mrs. Sarita Sharma': 'a1111111-2026-0001-0000-000000000001',
  'Mrs. Pinki Gupta': 'a1111111-2026-0002-0000-000000000002',
  'Mrs. S. Routh': 'a1111111-2026-0003-0000-000000000003',
  'Mr. Kalyan Mukhia': 'a1111111-2026-0004-0000-000000000004',
  'Mr. Akash Kharel': 'a1111111-2026-0005-0000-000000000005',
  'Ms. Kalyani Sharma': 'a1111111-2026-0006-0000-000000000006',
  'Ms. Promeeta Thapa': 'a1111111-2026-0007-0000-000000000007',
  'Mr. Prajwal Singh': 'a1111111-2026-0008-0000-000000000008',
  'Mr. Deven Gurung': 'a1111111-2026-0009-0000-000000000009',
  'Mr. Pranay Pradhan': 'a1111111-2026-0020-0000-000000000020',
  'Ms. Pratika Tamang': 'a1111111-2026-0021-0000-000000000021',
  'Ms. Supriya Chettri': 'a1111111-2026-0022-0000-000000000022',
  'Ms. Anupama Gurung': 'a1111111-2026-0023-0000-000000000023',
  'Mr. Rajesh Singh': 'a1111111-2026-0024-0000-000000000024',
  'Mr. Sagar Gurung': 'a1111111-2026-0025-0000-000000000025',
  'Mr. Rahul Chettri': 'a1111111-2026-0026-0000-000000000026'
};

const PERIOD_TIMES = {
  1: { name: '1st Period', start: '08:00', end: '08:40' },
  2: { name: '2nd Period', start: '08:40', end: '09:20' },
  3: { name: '3rd Period', start: '09:20', end: '10:00' },
  4: { name: '4th Period', start: '10:00', end: '10:40' },
  5: { name: '5th Period', start: '10:40', end: '11:20' },
  6: { name: '6th Period', start: '11:20', end: '12:00' },
  7: { name: '7th Period', start: '12:00', end: '12:40' },
  8: { name: '8th Period', start: '12:40', end: '13:20' },
  9: { name: '9th Period', start: '13:20', end: '14:00' }
};

// 1. SUBODH RAI AUTHENTIC SCHEDULE (Handwritten Timetable)
const subodhSchedule = [
  // Monday: 1st 7A Chem, 2nd 7B Phy, 6th 6B Math, 7th 6B Phy, 8th 6A Phy
  { teacher: 'Subodh', day: 1, period: 1, classKey: '7A', className: '7', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 1, period: 2, classKey: '7B', className: '7', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 1, period: 6, classKey: '6B', className: '6', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 1, period: 7, classKey: '6B', className: '6', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 1, period: 8, classKey: '6A', className: '6', section: 'A', subject: 'Physics', type: 'SUBJECT' },

  // Tuesday: 1st Assembly/Moral Science (7A), 2nd 7B Chem, 5th 6B Phy, 6th 6A Math, 8th 7A Phy, 9th Test
  { teacher: 'Subodh', day: 2, period: 1, classKey: '7A', className: '7', section: 'A', subject: 'Assembly or Moral Science', type: 'ASSEMBLY', notes: 'Assembly or M.Sc (7A)' },
  { teacher: 'Subodh', day: 2, period: 2, classKey: '7B', className: '7', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 2, period: 5, classKey: '6B', className: '6', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 2, period: 6, classKey: '6A', className: '6', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 2, period: 8, classKey: '7A', className: '7', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 2, period: 9, classKey: '7A', className: '7', section: 'A', subject: 'Weekly Test', type: 'TEST', notes: 'Weekly Test (7A Class Teacher)' },

  // Wednesday: 1st 7A Chem, 3rd 7B Chem, 4th 6A Math, 6th 6A Phy, 7th 7B Phy, 9th 6A
  { teacher: 'Subodh', day: 3, period: 1, classKey: '7A', className: '7', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 3, period: 3, classKey: '7B', className: '7', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 3, period: 4, classKey: '6A', className: '6', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 3, period: 6, classKey: '6A', className: '6', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 3, period: 7, classKey: '7B', className: '7', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 3, period: 9, classKey: '6A', className: '6', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY', notes: 'Class 6A Activity / Remedial' },

  // Thursday: 1st 7A Phy, 2nd 6A Phy, 4th 6A Math, 6th 7B Phy, 7th 6B Library, 8th 6B Math
  { teacher: 'Subodh', day: 4, period: 1, classKey: '7A', className: '7', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 4, period: 2, classKey: '6A', className: '6', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 4, period: 4, classKey: '6A', className: '6', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 4, period: 6, classKey: '7B', className: '7', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 4, period: 7, classKey: '6B', className: '6', section: 'B', subject: 'Library', type: 'LIBRARY' },
  { teacher: 'Subodh', day: 4, period: 8, classKey: '6B', className: '6', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },

  // Friday: 1st 7A Chem, 3rd 7B Chem, 4th 6B Phy, 6th 7A Phy, 7th 6B Math, 9th 7A
  { teacher: 'Subodh', day: 5, period: 1, classKey: '7A', className: '7', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 5, period: 3, classKey: '7B', className: '7', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 5, period: 4, classKey: '6B', className: '6', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 5, period: 6, classKey: '7A', className: '7', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 5, period: 7, classKey: '6B', className: '6', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Subodh', day: 5, period: 9, classKey: '7A', className: '7', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY', notes: 'Class 7A Class Teacher Period' }
];

// 2. OTHER TEACHERS' AUTHENTIC SCHEDULES (From Principal's Master Roster)
const otherTeachersSchedule = [
  // Pinki BK
  { teacher: 'Pinki BK', day: 2, period: 2, classKey: '7A', className: '7', section: 'A', subject: 'TL Nepali', type: 'SUBJECT' },
  { teacher: 'Pinki BK', day: 2, period: 4, classKey: '6A', className: '6', section: 'A', subject: 'TL Nepali', type: 'SUBJECT' },
  { teacher: 'Pinki BK', day: 2, period: 7, classKey: '5A', className: '5', section: 'A', subject: 'TL Nepali', type: 'SUBJECT' },
  { teacher: 'Pinki BK', day: 2, period: 8, classKey: '8A', className: '8', section: 'A', subject: 'TL Nepali', type: 'SUBJECT' },
  { teacher: 'Pinki BK', day: 2, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Weekly Test', type: 'TEST' },

  // Dipika Chettri (5-Eng 2, 5B-Spell)
  { teacher: 'Dipika Chettri', day: 1, period: 4, classKey: '5A', className: '5', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Dipika Chettri', day: 1, period: 6, classKey: '5B', className: '5', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Dipika Chettri', day: 3, period: 7, classKey: '5A', className: '5', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Dipika Chettri', day: 3, period: 8, classKey: '5B', className: '5', section: 'B', subject: 'Spelling', type: 'SUBJECT' },
  { teacher: 'Dipika Chettri', day: 4, period: 7, classKey: '5B', className: '5', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Dipika Chettri', day: 5, period: 3, classKey: '5B', className: '5', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Dipika Chettri', day: 5, period: 5, classKey: '5A', className: '5', section: 'A', subject: 'English 2', type: 'SUBJECT' },

  // Sashank Lama (Music)
  { teacher: 'Sashank Lama', day: 1, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 1, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 1, period: 9, classKey: '5A', className: '5', section: 'A', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 2, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 2, period: 9, classKey: '10H', className: '10', section: 'H', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Sashank Lama', day: 3, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 3, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 3, period: 9, classKey: '5A', className: '5', section: 'A', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 4, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 4, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 4, period: 9, classKey: '5A', className: '5', section: 'A', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 5, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'Music', type: 'SINGING' },
  { teacher: 'Sashank Lama', day: 5, period: 9, classKey: '5B', className: '5', section: 'B', subject: 'Music', type: 'SINGING' },

  // Dhirendra Lama (Art, SUPW, Singing, Drawing, Library - 30 Periods from handwritten timetable)
  // Monday (6): P2 11Sc (SUPW), P3 5A (Library), P5 5B (Singing), P6 6A (Singing), P7 9H (Art), P8 10H (Art)
  { teacher: 'Dhirendra Lama', day: 1, period: 2, classKey: '11Sc', className: '11', section: 'Sc', subject: 'SUPW', type: 'SUPW' },
  { teacher: 'Dhirendra Lama', day: 1, period: 3, classKey: '5A', className: '5', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Dhirendra Lama', day: 1, period: 5, classKey: '5B', className: '5', section: 'B', subject: 'Singing', type: 'SINGING' },
  { teacher: 'Dhirendra Lama', day: 1, period: 6, classKey: '6A', className: '6', section: 'A', subject: 'Singing', type: 'SINGING' },
  { teacher: 'Dhirendra Lama', day: 1, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 1, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },

  // Tuesday (6): P1 9H (Assembly/M.Sc), P2 12H (SUPW), P3 9H (Library), P6 10H (Library), P8 10H (Art), P9 9H (Weekly Test)
  { teacher: 'Dhirendra Lama', day: 2, period: 1, classKey: '9H', className: '9', section: 'H', subject: 'Assembly / M.Sc.', type: 'ASSEMBLY', notes: '9H Assembly / Moral Science' },
  { teacher: 'Dhirendra Lama', day: 2, period: 2, classKey: '12H', className: '12', section: 'H', subject: 'SUPW', type: 'SUPW' },
  { teacher: 'Dhirendra Lama', day: 2, period: 3, classKey: '9H', className: '9', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Dhirendra Lama', day: 2, period: 6, classKey: '10H', className: '10', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Dhirendra Lama', day: 2, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 2, period: 9, classKey: '9H', className: '9', section: 'H', subject: 'Weekly Test', type: 'TEST', notes: '9H Weekly Test Duty' },

  // Wednesday (6): P2 7A (Singing), P5 5A (Singing), P6 7B (Singing), P7 9H (Art), P8 10H (Art), P9 7A (Singing / Activity)
  { teacher: 'Dhirendra Lama', day: 3, period: 2, classKey: '7A', className: '7', section: 'A', subject: 'Singing', type: 'SINGING' },
  { teacher: 'Dhirendra Lama', day: 3, period: 5, classKey: '5A', className: '5', section: 'A', subject: 'Singing', type: 'SINGING' },
  { teacher: 'Dhirendra Lama', day: 3, period: 6, classKey: '7B', className: '7', section: 'B', subject: 'Singing', type: 'SINGING' },
  { teacher: 'Dhirendra Lama', day: 3, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 3, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 3, period: 9, classKey: '7A', className: '7', section: 'A', subject: 'Singing / Activity', type: 'SINGING' },

  // Thursday (7): P2 10H (SUPW), P3 6B (Singing), P5 5A (Drawing), P6 5B (Tables), P7 9H (Art), P8 10H (Art), P9 11Sc (SUPW)
  { teacher: 'Dhirendra Lama', day: 4, period: 2, classKey: '10H', className: '10', section: 'H', subject: 'SUPW', type: 'SUPW' },
  { teacher: 'Dhirendra Lama', day: 4, period: 3, classKey: '6B', className: '6', section: 'B', subject: 'Singing', type: 'SINGING' },
  { teacher: 'Dhirendra Lama', day: 4, period: 5, classKey: '5A', className: '5', section: 'A', subject: 'Drawing', type: 'DRAWING' },
  { teacher: 'Dhirendra Lama', day: 4, period: 6, classKey: '5B', className: '5', section: 'B', subject: 'Tables', type: 'TABLES' },
  { teacher: 'Dhirendra Lama', day: 4, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 4, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 4, period: 9, classKey: '11Sc', className: '11', section: 'Sc', subject: 'SUPW', type: 'SUPW' },

  // Friday (5): P1 8A (Library), P5 9H (Library), P6 5B (Drawing), P8 9H (Art), P9 5B (Drawing / Activity)
  { teacher: 'Dhirendra Lama', day: 5, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Dhirendra Lama', day: 5, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Dhirendra Lama', day: 5, period: 6, classKey: '5B', className: '5', section: 'B', subject: 'Drawing', type: 'DRAWING' },
  { teacher: 'Dhirendra Lama', day: 5, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'Art', type: 'DRAWING', notes: 'Parallel Elective with Music' },
  { teacher: 'Dhirendra Lama', day: 5, period: 9, classKey: '5B', className: '5', section: 'B', subject: 'Drawing / Activity', type: 'DRAWING' },

  // Ajoy Gurung (Library across Classes 5 to 12 - 21 Periods from handwritten timetable)
  // Monday (4): P3 5A Library, P4 10H Library, P7 7A Library, P9 7A Library
  { teacher: 'Ajoy Gurung', day: 1, period: 3, classKey: '5A', className: '5', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
  { teacher: 'Ajoy Gurung', day: 1, period: 4, classKey: '10H', className: '10', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With RS / PS' },
  { teacher: 'Ajoy Gurung', day: 1, period: 7, classKey: '7A', className: '7', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Keiran Thapa (KT)' },
  { teacher: 'Ajoy Gurung', day: 1, period: 9, classKey: '7A', className: '7', section: 'A', subject: 'Library', type: 'LIBRARY' },

  // Tuesday (4): P3 9H Library, P6 10H Library, P8 11H Library, P9 7B Weekly Test Duty
  { teacher: 'Ajoy Gurung', day: 2, period: 3, classKey: '9H', className: '9', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
  { teacher: 'Ajoy Gurung', day: 2, period: 6, classKey: '10H', className: '10', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
  { teacher: 'Ajoy Gurung', day: 2, period: 8, classKey: '11H', className: '11', section: 'H', subject: 'Library', type: 'LIBRARY' },
  { teacher: 'Ajoy Gurung', day: 2, period: 9, classKey: '7B', className: '7', section: 'B', subject: 'Weekly Test', type: 'TEST', notes: 'Weekly Test Duty (Senior School / 7B)' },

  // Wednesday (4): P4 7B Library, P7 5B Library, P8 12H Library, P9 7B Library
  { teacher: 'Ajoy Gurung', day: 3, period: 4, classKey: '7B', className: '7', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With DP (Mrs. Dipika Thapa)' },
  { teacher: 'Ajoy Gurung', day: 3, period: 7, classKey: '5B', className: '5', section: 'B', subject: 'Library', type: 'LIBRARY' },
  { teacher: 'Ajoy Gurung', day: 3, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Rai Sir / Rajesh Sharma (Raj S.)' },
  { teacher: 'Ajoy Gurung', day: 3, period: 9, classKey: '7B', className: '7', section: 'B', subject: 'Library', type: 'LIBRARY' },

  // Thursday (5): P3 8B Library, P4 5B Library, P6 5A Library, P7 6B Library, P9 8A Library
  { teacher: 'Ajoy Gurung', day: 4, period: 3, classKey: '8B', className: '8', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With Sujil (Sujl)' },
  { teacher: 'Ajoy Gurung', day: 4, period: 4, classKey: '5B', className: '5', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With Suresh / Subodh (Su Ro)' },
  { teacher: 'Ajoy Gurung', day: 4, period: 6, classKey: '5A', className: '5', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Suresh / Subodh (Su. Ro)' },
  { teacher: 'Ajoy Gurung', day: 4, period: 7, classKey: '6B', className: '6', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Subodh Rai (SUB R)' },
  { teacher: 'Ajoy Gurung', day: 4, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Library', type: 'LIBRARY' },

  // Friday (4): P1 8A Library, P5 9H Library, P8 6A Library, P9 8B Library
  { teacher: 'Ajoy Gurung', day: 5, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
  { teacher: 'Ajoy Gurung', day: 5, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Dhirendra Lama (DL)' },
  { teacher: 'Ajoy Gurung', day: 5, period: 8, classKey: '6A', className: '6', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With P. Tamang' },
  { teacher: 'Ajoy Gurung', day: 5, period: 9, classKey: '8B', className: '8', section: 'B', subject: 'Library', type: 'LIBRARY' },

  // Keiran Thapa (English 2, Class 8A)
  { teacher: 'Keiran Thapa', day: 1, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Keiran Thapa', day: 2, period: 3, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Keiran Thapa', day: 3, period: 2, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Keiran Thapa', day: 4, period: 4, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Keiran Thapa', day: 5, period: 4, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },

  // Rakesh Rai (Handwriting, Art & Craft)
  { teacher: 'Rakesh Rai', day: 2, period: 1, classKey: '7B', className: '7', section: 'B', subject: 'Assembly / M.Sc.', type: 'ASSEMBLY' },
  { teacher: 'Rakesh Rai', day: 2, period: 2, classKey: '5A', className: '5', section: 'A', subject: 'Handwriting', type: 'SUBJECT' },
  { teacher: 'Rakesh Rai', day: 2, period: 3, classKey: '5B', className: '5', section: 'B', subject: 'Handwriting', type: 'SUBJECT' },
  { teacher: 'Rakesh Rai', day: 2, period: 4, classKey: '5A', className: '5', section: 'A', subject: 'Art & Craft', type: 'DRAWING' },
  { teacher: 'Rakesh Rai', day: 2, period: 5, classKey: '5A', className: '5', section: 'A', subject: 'Art & Craft', type: 'DRAWING' },
  { teacher: 'Rakesh Rai', day: 2, period: 7, classKey: '5B', className: '5', section: 'B', subject: 'Art & Craft', type: 'DRAWING' },
  { teacher: 'Rakesh Rai', day: 2, period: 8, classKey: '5B', className: '5', section: 'B', subject: 'Art & Craft', type: 'DRAWING' },
  { teacher: 'Rakesh Rai', day: 2, period: 9, classKey: '5A', className: '5', section: 'A', subject: 'Weekly Test', type: 'TEST' },

  // Physical Training Instructors (PTI)
  { teacher: 'Physical Training Instructors (PTI)', day: 2, period: 4, classKey: '8B', className: '8', section: 'B', subject: 'PT / Games', type: 'GAMES' },
  { teacher: 'Physical Training Instructors (PTI)', day: 2, period: 5, classKey: '8B', className: '8', section: 'B', subject: 'PT / Games', type: 'GAMES' },
  // Mrs. Sarita Sharma (32 Periods)
  { teacher: 'Mrs. Sarita Sharma', day: 1, period: 2, classKey: '10H', className: '10', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 1, period: 4, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 1, period: 5, classKey: '11', className: '11', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 1, period: 6, classKey: '9H', className: '9', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 1, period: 8, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 1, period: 9, classKey: '12Sc', className: '12', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 1, classKey: 'All', className: 'All', section: '', subject: 'Morning Assembly', type: 'ASSEMBLY' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 3, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 4, classKey: '9H', className: '9', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 5, classKey: '12', className: '12', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 6, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 7, classKey: '11', className: '11', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 2, classKey: '11', className: '11', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 3, classKey: '10H', className: '10', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 4, classKey: '12', className: '12', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 5, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 6, classKey: '9H', className: '9', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 8, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 3, period: 9, classKey: '12Sc', className: '12', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 4, period: 1, classKey: '9H', className: '9', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 4, period: 2, classKey: '11', className: '11', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 4, period: 3, classKey: '12', className: '12', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 4, period: 6, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 4, period: 7, classKey: '10H', className: '10', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 4, period: 9, classKey: '12Sc', className: '12', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 5, period: 2, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 5, period: 3, classKey: '12', className: '12', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 5, period: 4, classKey: '11', className: '11', section: '', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 5, period: 7, classKey: '10H', className: '10', section: 'H', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Mrs. Sarita Sharma', day: 5, period: 8, classKey: '6B', className: '6', section: 'B', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Mrs. Sarita Sharma', day: 5, period: 9, classKey: '12Sc', className: '12', section: 'Sc', subject: '2L Nepali', type: 'SUBJECT' },

  // Mrs. Pinki Gupta (32 Periods)
  { teacher: 'Mrs. Pinki Gupta', day: 1, period: 2, classKey: '10H', className: '10', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 1, period: 4, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 1, period: 5, classKey: '11', className: '11', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 1, period: 6, classKey: '9H', className: '9', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 1, period: 8, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 1, period: 9, classKey: '12H', className: '12', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 2, period: 3, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 2, period: 4, classKey: '9H', className: '9', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 2, period: 5, classKey: '12', className: '12', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 2, period: 6, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 2, period: 7, classKey: '11', className: '11', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 2, classKey: '11', className: '11', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 3, classKey: '10H', className: '10', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 4, classKey: '12', className: '12', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 5, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 6, classKey: '9H', className: '9', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 8, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 3, period: 9, classKey: '12H', className: '12', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 1, classKey: '9H', className: '9', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 2, classKey: '11', className: '11', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 3, classKey: '12', className: '12', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 4, classKey: '7B', className: '7', section: 'B', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 6, classKey: '9Sc', className: '9', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 7, classKey: '10H', className: '10', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 4, period: 9, classKey: '12H', className: '12', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 5, period: 2, classKey: '10Sc', className: '10', section: 'Sc', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 5, period: 3, classKey: '12', className: '12', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 5, period: 4, classKey: '11', className: '11', section: '', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 5, period: 6, classKey: '8B', className: '8', section: 'B', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 5, period: 7, classKey: '10H', className: '10', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. Pinki Gupta', day: 5, period: 9, classKey: '12H', className: '12', section: 'H', subject: '2L Hindi', type: 'SUBJECT' },

  // Mrs. S. Routh (26 Periods)
  { teacher: 'Mrs. S. Routh', day: 1, period: 4, classKey: '8A', className: '8', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 1, period: 6, classKey: '5A', className: '5', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 1, period: 7, classKey: '6A', className: '6', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 1, period: 8, classKey: '7A', className: '7', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 1, period: 9, classKey: '5B', className: '5', section: 'B', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 2, period: 2, classKey: '7A', className: '7', section: 'A', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 2, period: 4, classKey: '6A', className: '6', section: 'A', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 2, period: 7, classKey: '5A', className: '5', section: 'A', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 2, period: 8, classKey: '8A', className: '8', section: 'A', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 2, period: 9, classKey: 'Junior', className: 'Junior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mrs. S. Routh', day: 3, period: 4, classKey: '8A', className: '8', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 3, period: 6, classKey: '5A', className: '5', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 3, period: 7, classKey: '6A', className: '6', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 3, period: 8, classKey: '7A', className: '7', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 3, period: 9, classKey: '5B', className: '5', section: 'B', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 4, period: 3, classKey: '5B', className: '5', section: 'B', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 4, period: 4, classKey: '5B', className: '5', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Mrs. S. Routh', day: 4, period: 5, classKey: '6B', className: '6', section: 'B', subject: 'TL Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 4, period: 6, classKey: '5A', className: '5', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Mrs. S. Routh', day: 4, period: 9, classKey: '7A', className: '7', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 5, period: 4, classKey: '8A', className: '8', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 5, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 5, period: 6, classKey: '5A', className: '5', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 5, period: 7, classKey: '6A', className: '6', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 5, period: 8, classKey: '7A', className: '7', section: 'A', subject: 'Hindi', type: 'SUBJECT' },
  { teacher: 'Mrs. S. Routh', day: 5, period: 9, classKey: '7B', className: '7', section: 'B', subject: 'Hindi / Activity', type: 'SUBJECT' },

  // Mr. Kalyan Mukhia (23 Periods)
  { teacher: 'Mr. Kalyan Mukhia', day: 1, period: 2, classKey: '8A', className: '8', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 1, period: 3, classKey: '8B', className: '8', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 1, period: 6, classKey: '8A', className: '8', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 1, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY' },
  { teacher: 'Mr. Kalyan Mukhia', day: 2, period: 2, classKey: '8B', className: '8', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 2, period: 3, classKey: '7A', className: '7', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 2, period: 6, classKey: '7B', className: '7', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 2, period: 7, classKey: '8A', className: '8', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 2, period: 9, classKey: 'Middle', className: 'Middle', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Kalyan Mukhia', day: 3, period: 3, classKey: '7A', className: '7', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 3, period: 5, classKey: '7B', className: '7', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 3, period: 6, classKey: '8B', className: '8', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 3, period: 7, classKey: '8A', className: '8', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 3, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY' },
  { teacher: 'Mr. Kalyan Mukhia', day: 4, period: 1, classKey: '8B', className: '8', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 4, period: 2, classKey: '7B', className: '7', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 4, period: 3, classKey: '8A', className: '8', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 4, period: 6, classKey: '8A', className: '8', section: 'A', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 4, period: 7, classKey: '8B', className: '8', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 4, period: 9, classKey: '8B', className: '8', section: 'B', subject: 'Special Activity', type: 'SPECIAL ACTIVITY' },
  { teacher: 'Mr. Kalyan Mukhia', day: 5, period: 3, classKey: '8B', className: '8', section: 'B', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 5, period: 7, classKey: '7A', className: '7', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Kalyan Mukhia', day: 5, period: 9, classKey: '7B', className: '7', section: 'B', subject: 'Special Activity', type: 'SPECIAL ACTIVITY', notes: 'With Mr. Subodh Rai' },

  // Mr. Akash Kharel (27 Periods)
  { teacher: 'Mr. Akash Kharel', day: 1, period: 2, classKey: '11H', className: '11', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 1, period: 3, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 1, period: 5, classKey: '12H', className: '12', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 1, period: 6, classKey: '10H', className: '10', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 1, period: 8, classKey: '6B', className: '6', section: 'B', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 1, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY' },
  { teacher: 'Mr. Akash Kharel', day: 2, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 2, period: 4, classKey: '12H', className: '12', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 2, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 2, period: 7, classKey: '10H', className: '10', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 2, period: 8, classKey: '6A', className: '6', section: 'A', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Akash Kharel', day: 3, period: 2, classKey: '12H', className: '12', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 3, period: 4, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 3, period: 6, classKey: '10H', className: '10', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 3, period: 7, classKey: '11H', className: '11', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 3, period: 9, classKey: '11H', className: '11', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 4, period: 3, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 4, period: 4, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 4, period: 6, classKey: '11H', className: '11', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 4, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 4, period: 9, classKey: '8B', className: '8', section: 'B', subject: 'Special Activity', type: 'SPECIAL ACTIVITY' },
  { teacher: 'Mr. Akash Kharel', day: 5, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 5, period: 5, classKey: '12H', className: '12', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 5, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 5, period: 8, classKey: '10H', className: '10', section: 'H', subject: 'Economics', type: 'SUBJECT' },
  { teacher: 'Mr. Akash Kharel', day: 5, period: 9, classKey: '9H', className: '9', section: 'H', subject: 'Economics', type: 'SUBJECT' },

  // Ms. Kalyani Sharma (27 Periods)
  { teacher: 'Ms. Kalyani Sharma', day: 1, period: 2, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 1, period: 3, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 1, period: 5, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 1, period: 7, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 1, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 2, period: 2, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 2, period: 3, classKey: '10H', className: '10', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 2, period: 4, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 2, period: 6, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 2, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Ms. Kalyani Sharma', day: 3, period: 3, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 3, period: 4, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 3, period: 6, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 3, period: 7, classKey: '10H', className: '10', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 3, period: 9, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 4, period: 2, classKey: '9H', className: '9', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 4, period: 4, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 4, period: 5, classKey: '10H', className: '10', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 4, period: 6, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 4, period: 7, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 4, period: 9, classKey: '6A', className: '6', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 5, period: 2, classKey: '10H', className: '10', section: 'H', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 5, period: 3, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 5, period: 5, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 5, period: 6, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Ms. Kalyani Sharma', day: 5, period: 8, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Mathematics', type: 'SUBJECT' },

  // Ms. Promeeta Thapa (26 Periods)
  { teacher: 'Ms. Promeeta Thapa', day: 1, period: 2, classKey: '9H', className: '9', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 1, period: 3, classKey: '10H', className: '10', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 1, period: 5, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 1, period: 7, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 1, period: 9, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 2, period: 2, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 2, period: 3, classKey: '8B', className: '8', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 2, period: 4, classKey: '10H', className: '10', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 2, period: 6, classKey: '8A', className: '8', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 2, period: 7, classKey: '9H', className: '9', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Ms. Promeeta Thapa', day: 3, period: 2, classKey: '8A', className: '8', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 3, period: 3, classKey: '9H', className: '9', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 3, period: 5, classKey: '8B', className: '8', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 3, period: 6, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 3, period: 9, classKey: '10H', className: '10', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 4, period: 2, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 4, period: 4, classKey: '10H', className: '10', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 4, period: 5, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 4, period: 6, classKey: '8B', className: '8', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 4, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 5, period: 2, classKey: '9H', className: '9', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 5, period: 3, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 5, period: 4, classKey: '10H', className: '10', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 5, period: 7, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Ms. Promeeta Thapa', day: 5, period: 8, classKey: '8A', className: '8', section: 'A', subject: 'English 1', type: 'SUBJECT' },

  // Mr. Prajwal Singh (29 Periods)
  { teacher: 'Mr. Prajwal Singh', day: 1, period: 4, classKey: '10H', className: '10', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Mr. Prajwal Singh', day: 1, period: 5, classKey: '11', className: '11', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 1, period: 7, classKey: '9', className: '9', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 1, period: 8, classKey: '10', className: '10', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 1, period: 9, classKey: '11H', className: '11', section: 'H', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 2, period: 1, classKey: '11H', className: '11', section: 'H', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mr. Prajwal Singh', day: 2, period: 5, classKey: '12', className: '12', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 2, period: 7, classKey: '11', className: '11', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 2, period: 8, classKey: '10', className: '10', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Prajwal Singh', day: 3, period: 2, classKey: '11', className: '11', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 3, period: 3, classKey: '5A', className: '5', section: 'A', subject: 'Tables', type: 'TABLES' },
  { teacher: 'Mr. Prajwal Singh', day: 3, period: 4, classKey: '12', className: '12', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 3, period: 7, classKey: '9', className: '9', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 3, period: 8, classKey: '10', className: '10', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 3, period: 9, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 1, classKey: '5B', className: '5', section: 'B', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 2, classKey: '11', className: '11', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 3, classKey: '12', className: '12', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 5, classKey: '7A', className: '7', section: 'A', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 7, classKey: '9', className: '9', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 8, classKey: '10', className: '10', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 4, period: 9, classKey: '11H', className: '11', section: 'H', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 5, period: 1, classKey: '6A', className: '6', section: 'A', subject: 'Taekwondo', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 5, period: 3, classKey: '12', className: '12', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 5, period: 4, classKey: '11', className: '11', section: '', subject: 'Physical Education', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 5, period: 6, classKey: '7B', className: '7', section: 'B', subject: 'Taekwondo', type: 'GAMES' },
  { teacher: 'Mr. Prajwal Singh', day: 5, period: 8, classKey: '9', className: '9', section: '', subject: 'PT / Games', type: 'GAMES', notes: 'Parallel Elective' },
  { teacher: 'Mr. Prajwal Singh', day: 5, period: 9, classKey: '11H', className: '11', section: 'H', subject: 'Physical Education', type: 'GAMES' },

  // Mr. Deven Gurung (16 Periods)
  { teacher: 'Mr. Deven Gurung', day: 1, period: 3, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 1, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 1, period: 7, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 1, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 2, period: 5, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 2, period: 6, classKey: '9H', className: '9', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 2, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 3, period: 4, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 3, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 3, period: 7, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 3, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 4, period: 4, classKey: '9Sc', className: '9', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 4, period: 7, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 4, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Deven Gurung', day: 5, period: 4, classKey: '9H', className: '9', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Deven Gurung', day: 5, period: 8, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  // Mrs. Pallavi Bakshi (29 Periods)
  { teacher: 'Mrs. Pallavi Bakshi', day: 1, period: 1, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 1, period: 2, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 1, period: 3, classKey: '7A', className: '7', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 1, period: 5, classKey: '6B', className: '6', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 1, period: 7, classKey: '7B', className: '7', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 1, period: 8, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 1, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 2, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 4, classKey: '6B', className: '6', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 5, classKey: '7A', className: '7', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 7, classKey: '6A', className: '6', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 8, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 3, period: 1, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 3, period: 3, classKey: '6A', className: '6', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 3, period: 6, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 3, period: 7, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology Practical', type: 'PRACTICAL' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 3, period: 8, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology Practical', type: 'PRACTICAL' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 4, period: 1, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 4, period: 2, classKey: '6B', className: '6', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 4, period: 5, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 4, period: 6, classKey: '7A', className: '7', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 4, period: 7, classKey: '7B', className: '7', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 4, period: 9, classKey: '7B', className: '7', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 5, period: 1, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 5, period: 2, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology Practical', type: 'PRACTICAL' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 5, period: 3, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Biology Practical', type: 'PRACTICAL' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 5, period: 5, classKey: '6A', className: '6', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Pallavi Bakshi', day: 5, period: 8, classKey: '7B', className: '7', section: 'B', subject: 'Biology', type: 'SUBJECT' },

  // Mrs. Sailika Thapa (20 Periods)
  { teacher: 'Mrs. Sailika Thapa', day: 1, period: 2, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 1, period: 4, classKey: '12', className: '12', section: '', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 1, period: 5, classKey: '10H', className: '10', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 1, period: 6, classKey: '11H', className: '11', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 2, period: 1, classKey: 'All', className: 'All', section: '', subject: 'Morning Assembly', type: 'ASSEMBLY' },
  { teacher: 'Mrs. Sailika Thapa', day: 2, period: 3, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 2, period: 5, classKey: '10H', className: '10', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 2, period: 6, classKey: '11H', className: '11', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 3, period: 2, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 3, period: 3, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 3, period: 5, classKey: '12', className: '12', section: '', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 3, period: 6, classKey: '11H', className: '11', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 4, period: 1, classKey: '10H', className: '10', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 4, period: 3, classKey: '10Sc', className: '10', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 4, period: 4, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 4, period: 5, classKey: '12', className: '12', section: '', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 5, period: 2, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 5, period: 3, classKey: '10H', className: '10', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 5, period: 5, classKey: '11H', className: '11', section: 'H', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mrs. Sailika Thapa', day: 5, period: 6, classKey: '12', className: '12', section: '', subject: 'English 2', type: 'SUBJECT' },

  // Mrs. Anjana Gurung (12 Periods)
  { teacher: 'Mrs. Anjana Gurung', day: 1, period: 2, classKey: '5A', className: '5', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 1, period: 3, classKey: '5B', className: '5', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 1, period: 4, classKey: '6B', className: '6', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 2, period: 2, classKey: '5B', className: '5', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 2, period: 3, classKey: '6A', className: '6', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 3, period: 2, classKey: '5A', className: '5', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 3, period: 3, classKey: '6B', className: '6', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 4, period: 2, classKey: '5B', className: '5', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 4, period: 3, classKey: '6A', className: '6', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 5, period: 2, classKey: '5A', className: '5', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 5, period: 3, classKey: '6B', className: '6', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mrs. Anjana Gurung', day: 5, period: 4, classKey: '6A', className: '6', section: 'A', subject: 'English 1', type: 'SUBJECT' },

  // Mr. Riwaz Pradhan (30 Periods)
  { teacher: 'Mr. Riwaz Pradhan', day: 1, period: 1, classKey: '11H', className: '11', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 1, period: 2, classKey: '12H', className: '12', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 1, period: 4, classKey: '7B', className: '7', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 1, period: 5, classKey: '7A', className: '7', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 1, period: 7, classKey: '12H', className: '12', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 1, period: 8, classKey: '11H', className: '11', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 1, classKey: '11H', className: '11', section: 'H', subject: 'Morning Assembly', type: 'ASSEMBLY' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 2, classKey: '11H', className: '11', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 4, classKey: '7B', className: '7', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 5, classKey: '11H', className: '11', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 6, classKey: '12H', className: '12', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Riwaz Pradhan', day: 3, period: 1, classKey: '11H', className: '11', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 3, period: 3, classKey: '12H', className: '12', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 3, period: 4, classKey: '11H', className: '11', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 3, period: 6, classKey: '7A', className: '7', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 3, period: 7, classKey: '12H', className: '12', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 4, period: 1, classKey: '11H', className: '11', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 4, period: 2, classKey: '12H', className: '12', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 4, period: 4, classKey: '12H', className: '12', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 4, period: 5, classKey: '7B', className: '7', section: 'B', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 4, period: 7, classKey: '12H', className: '12', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 4, period: 8, classKey: '11H', className: '11', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 5, period: 1, classKey: '11H', className: '11', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 5, period: 2, classKey: '12H', className: '12', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 5, period: 4, classKey: '12H', className: '12', section: 'H', subject: 'Sociology', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 5, period: 5, classKey: '7A', className: '7', section: 'A', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 5, period: 6, classKey: '11H', className: '11', section: 'H', subject: 'Political Science', type: 'SUBJECT' },
  { teacher: 'Mr. Riwaz Pradhan', day: 5, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'Sociology', type: 'SUBJECT' },

  // Mr. Suraj Pradhan (27 Periods)
  { teacher: 'Mr. Suraj Pradhan', day: 1, period: 1, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 1, period: 2, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 1, period: 7, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics Practical', type: 'PRACTICAL' },
  { teacher: 'Mr. Suraj Pradhan', day: 1, period: 8, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics Practical', type: 'PRACTICAL' },
  { teacher: 'Mr. Suraj Pradhan', day: 1, period: 9, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 2, period: 1, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mr. Suraj Pradhan', day: 2, period: 3, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 2, period: 4, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 2, period: 6, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Suraj Pradhan', day: 3, period: 1, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 3, period: 2, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 3, period: 4, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 3, period: 5, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 3, period: 8, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 4, period: 1, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 4, period: 2, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 4, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'SUPW', type: 'SUPW' },
  { teacher: 'Mr. Suraj Pradhan', day: 4, period: 6, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 4, period: 8, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 4, period: 9, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 5, period: 1, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 5, period: 2, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 5, period: 5, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },
  { teacher: 'Mr. Suraj Pradhan', day: 5, period: 7, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics Practical', type: 'PRACTICAL' },
  { teacher: 'Mr. Suraj Pradhan', day: 5, period: 8, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics Practical', type: 'PRACTICAL' },
  { teacher: 'Mr. Suraj Pradhan', day: 5, period: 9, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Physics', type: 'SUBJECT' },

  // Mr. Keiran Thapa (29 Periods)
  { teacher: 'Mr. Keiran Thapa', day: 1, period: 1, classKey: '12H', className: '12', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 1, period: 3, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 1, period: 4, classKey: '11H', className: '11', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 1, period: 6, classKey: '12Sc', className: '12', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 1, period: 7, classKey: '7A', className: '7', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Mr. Keiran Thapa', day: 1, period: 9, classKey: '8B', className: '8', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 2, period: 1, classKey: '12H', className: '12', section: 'H', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mr. Keiran Thapa', day: 2, period: 2, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 2, period: 3, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 2, period: 5, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 2, period: 8, classKey: '8B', className: '8', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Keiran Thapa', day: 3, period: 1, classKey: '12H', className: '12', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 3, period: 3, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 3, period: 5, classKey: '11H', className: '11', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 3, period: 6, classKey: '12Sc', className: '12', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 3, period: 8, classKey: '8B', className: '8', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 3, period: 9, classKey: '6B', className: '6', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 4, period: 1, classKey: '12H', className: '12', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 4, period: 3, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 4, period: 5, classKey: '8B', className: '8', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 4, period: 7, classKey: '11H', className: '11', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 4, period: 8, classKey: '12Sc', className: '12', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 5, period: 1, classKey: '12H', className: '12', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 5, period: 2, classKey: '8A', className: '8', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 5, period: 4, classKey: '12Sc', className: '12', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 5, period: 6, classKey: '11Sc', className: '11', section: 'Sc', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 5, period: 7, classKey: '11H', className: '11', section: 'H', subject: 'English 1', type: 'SUBJECT' },
  { teacher: 'Mr. Keiran Thapa', day: 5, period: 8, classKey: '11H', className: '11', section: 'H', subject: 'English 1', type: 'SUBJECT' },

  // Mrs. Urvashi Rumba (28 Periods)
  { teacher: 'Mrs. Urvashi Rumba', day: 1, period: 1, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 1, period: 3, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 1, period: 5, classKey: '8B', className: '8', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 1, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 1, period: 9, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 2, period: 1, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mrs. Urvashi Rumba', day: 2, period: 3, classKey: '10H', className: '10', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 2, period: 4, classKey: '8A', className: '8', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 2, period: 5, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 2, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mrs. Urvashi Rumba', day: 3, period: 1, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 3, period: 3, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 3, period: 4, classKey: '8B', className: '8', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 3, period: 7, classKey: '10H', className: '10', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 3, period: 8, classKey: '8A', className: '8', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 3, period: 9, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 4, period: 1, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 4, period: 2, classKey: '9H', className: '9', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 4, period: 4, classKey: '8B', className: '8', section: 'B', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 4, period: 5, classKey: '10H', className: '10', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 4, period: 7, classKey: '8A', className: '8', section: 'A', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 4, period: 8, classKey: '5A', className: '5', section: 'A', subject: 'Elocution', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 5, period: 1, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 5, period: 2, classKey: '10H', className: '10', section: 'H', subject: 'EVS', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 5, period: 5, classKey: '5B', className: '5', section: 'B', subject: 'Elocution', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 5, period: 8, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },
  { teacher: 'Mrs. Urvashi Rumba', day: 5, period: 9, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Biology', type: 'SUBJECT' },

  // Ms. Sujata Rai (26 Periods)
  { teacher: 'Ms. Sujata Rai', day: 1, period: 1, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 1, period: 4, classKey: '9H', className: '9', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 1, period: 6, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 1, period: 9, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 2, period: 1, classKey: '10H', className: '10', section: 'H', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Ms. Sujata Rai', day: 2, period: 2, classKey: '9H', className: '9', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 2, period: 4, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 2, period: 7, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 2, period: 8, classKey: '5A', className: '5', section: 'A', subject: 'Spelling', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Ms. Sujata Rai', day: 3, period: 1, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 3, period: 2, classKey: '9H', className: '9', section: 'H', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 3, period: 3, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 3, period: 7, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 3, period: 8, classKey: '9H', className: '9', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 4, period: 2, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 4, period: 3, classKey: '8B', className: '8', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Ms. Sujata Rai', day: 4, period: 5, classKey: '9H', className: '9', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 4, period: 6, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 4, period: 9, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 5, period: 1, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 5, period: 3, classKey: '9H', className: '9', section: 'H', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 5, period: 4, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 5, period: 5, classKey: '10H', className: '10', section: 'H', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Ms. Sujata Rai', day: 5, period: 7, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Ms. Sujata Rai', day: 5, period: 9, classKey: '10H', className: '10', section: 'H', subject: 'Geography', type: 'SUBJECT' },

  // Mr. Dipanker Parajuli (29 Periods)
  { teacher: 'Mr. Dipanker Parajuli', day: 1, period: 1, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 1, period: 3, classKey: '8A', className: '8', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 1, period: 4, classKey: '8B', className: '8', section: 'B', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 1, period: 6, classKey: '8B', className: '8', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 1, period: 8, classKey: '8A', className: '8', section: 'A', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 1, period: 9, classKey: '7B', className: '7', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 2, period: 1, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mr. Dipanker Parajuli', day: 2, period: 5, classKey: '8A', className: '8', section: 'A', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 2, period: 6, classKey: '8B', className: '8', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 2, period: 8, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 1, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 2, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 4, classKey: '7B', className: '7', section: 'B', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 5, classKey: '10H', className: '10', section: 'H', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 6, classKey: '8A', className: '8', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 8, classKey: '7B', className: '7', section: 'B', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Mr. Dipanker Parajuli', day: 3, period: 9, classKey: '8B', className: '8', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 4, period: 3, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 4, period: 6, classKey: '9H', className: '9', section: 'H', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Mr. Dipanker Parajuli', day: 4, period: 7, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 4, period: 8, classKey: '8A', className: '8', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 4, period: 9, classKey: '9H', className: '9', section: 'H', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 5, period: 1, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 5, period: 2, classKey: '8B', className: '8', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 5, period: 3, classKey: '9Sc', className: '9', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 5, period: 5, classKey: '8B', className: '8', section: 'B', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 5, period: 6, classKey: '10H', className: '10', section: 'H', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Dipanker Parajuli', day: 5, period: 9, classKey: '6B', className: '6', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },

  // Mrs. Nirjala Pradhan (28 Periods)
  { teacher: 'Mrs. Nirjala Pradhan', day: 1, period: 1, classKey: '7B', className: '7', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 1, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 1, period: 6, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 1, period: 7, classKey: '8B', className: '8', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 1, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 1, classKey: '7B', className: '7', section: 'B', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 2, classKey: '8A', className: '8', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 3, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 4, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 6, classKey: '7A', className: '7', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 7, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 3, period: 1, classKey: '7B', className: '7', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 3, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 3, period: 5, classKey: '7A', className: '7', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 3, period: 6, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 3, period: 7, classKey: '8B', className: '8', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 3, period: 8, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 4, period: 2, classKey: '8A', className: '8', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 4, period: 4, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 4, period: 5, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 4, period: 6, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 4, period: 8, classKey: '7A', className: '7', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 5, period: 1, classKey: '7B', className: '7', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 5, period: 2, classKey: '11H', className: '11', section: 'H', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 5, period: 4, classKey: '8B', className: '8', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 5, period: 6, classKey: '8A', className: '8', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mrs. Nirjala Pradhan', day: 5, period: 7, classKey: '12H', className: '12', section: 'H', subject: 'Geography', type: 'SUBJECT' },

  // Mr. Pranay Pradhan (29 Periods)
  { teacher: 'Mr. Pranay Pradhan', day: 1, period: 1, classKey: '8B', className: '8', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 1, period: 2, classKey: '7A', className: '7', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 1, period: 4, classKey: '6A', className: '6', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 1, period: 5, classKey: '8A', className: '8', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 1, period: 7, classKey: '9', className: '9', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 1, period: 8, classKey: '10', className: '10', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 2, period: 1, classKey: '8B', className: '8', section: 'B', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mr. Pranay Pradhan', day: 2, period: 2, classKey: '6B', className: '6', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 2, period: 3, classKey: '7B', className: '7', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 2, period: 5, classKey: '6A', className: '6', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 2, period: 8, classKey: '10', className: '10', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Pranay Pradhan', day: 3, period: 1, classKey: '8B', className: '8', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 3, period: 2, classKey: '6B', className: '6', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 3, period: 4, classKey: '7A', className: '7', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 3, period: 5, classKey: '8A', className: '8', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 3, period: 7, classKey: '9', className: '9', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 3, period: 8, classKey: '10', className: '10', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 4, period: 3, classKey: '7B', className: '7', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 4, period: 4, classKey: '7A', className: '7', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 4, period: 6, classKey: '6A', className: '6', section: 'A', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 4, period: 7, classKey: '9', className: '9', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 4, period: 8, classKey: '10', className: '10', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 5, period: 2, classKey: '6B', className: '6', section: 'B', subject: 'Geography', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 5, period: 3, classKey: '8A', className: '8', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 5, period: 5, classKey: '7B', className: '7', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 5, period: 7, classKey: '8B', className: '8', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Pranay Pradhan', day: 5, period: 8, classKey: '9', className: '9', section: '', subject: 'Hospitality', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Pranay Pradhan', day: 5, period: 9, classKey: '10Sc', className: '10', section: 'Sc', subject: 'Hospitality', type: 'SUBJECT' },

  // Ms. Pratika Tamang (28 Periods)
  { teacher: 'Ms. Pratika Tamang', day: 1, period: 1, classKey: '9H', className: '9', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 1, period: 2, classKey: '11H', className: '11', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 1, period: 5, classKey: '12H', className: '12', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 1, period: 6, classKey: '9Sc', className: '9', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 1, period: 7, classKey: '10H', className: '10', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 1, classKey: '9H', className: '9', section: 'H', subject: 'Morning Assembly', type: 'ASSEMBLY' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 2, classKey: '10H', className: '10', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 4, classKey: '12H', className: '12', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 6, classKey: '9Sc', className: '9', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 7, classKey: '10Sc', className: '10', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Ms. Pratika Tamang', day: 3, period: 1, classKey: '9H', className: '9', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 3, period: 2, classKey: '12H', className: '12', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 3, period: 4, classKey: '10H', className: '10', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 3, period: 7, classKey: '11H', className: '11', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 3, period: 9, classKey: '9H', className: '9', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 4, period: 3, classKey: '10H', className: '10', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 4, period: 5, classKey: '10Sc', className: '10', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 4, period: 6, classKey: '11H', className: '11', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 4, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 4, period: 9, classKey: '10Sc', className: '10', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 5, period: 1, classKey: '9H', className: '9', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 5, period: 3, classKey: '11H', className: '11', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 5, period: 4, classKey: '10Sc', className: '10', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 5, period: 5, classKey: '12H', className: '12', section: 'H', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 5, period: 6, classKey: '9Sc', className: '9', section: 'Sc', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Ms. Pratika Tamang', day: 5, period: 8, classKey: '6A', className: '6', section: 'A', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },

  // Ms. Supriya Chettri (28 Periods)
  { teacher: 'Ms. Supriya Chettri', day: 1, period: 2, classKey: '5B', className: '5', section: 'B', subject: 'Science', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 1, period: 4, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 1, period: 5, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 1, period: 7, classKey: '5B', className: '5', section: 'B', subject: 'Social Studies', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 1, period: 8, classKey: '5A', className: '5', section: 'A', subject: 'Science', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 1, classKey: '5A', className: '5', section: 'A', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 3, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 4, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 6, classKey: '5A', className: '5', section: 'A', subject: 'Social Studies', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 7, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry Practical', type: 'PRACTICAL' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 8, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry Practical', type: 'PRACTICAL' },
  { teacher: 'Ms. Supriya Chettri', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Ms. Supriya Chettri', day: 3, period: 1, classKey: '5A', className: '5', section: 'A', subject: 'Social Studies', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 3, period: 2, classKey: '5B', className: '5', section: 'B', subject: 'Science', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 3, period: 3, classKey: '5B', className: '5', section: 'B', subject: 'Social Studies', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 3, period: 5, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 3, period: 7, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 3, period: 8, classKey: '5A', className: '5', section: 'A', subject: 'Science', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 4, period: 1, classKey: '5A', className: '5', section: 'A', subject: 'Social Studies', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 4, period: 4, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 4, period: 5, classKey: '5B', className: '5', section: 'B', subject: 'Science', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 4, period: 7, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Chemistry Practical', type: 'PRACTICAL' },
  { teacher: 'Ms. Supriya Chettri', day: 4, period: 8, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Chemistry Practical', type: 'PRACTICAL' },
  { teacher: 'Ms. Supriya Chettri', day: 5, period: 1, classKey: '5A', className: '5', section: 'A', subject: 'Science', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 5, period: 4, classKey: '5B', className: '5', section: 'B', subject: 'Social Studies', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 5, period: 5, classKey: '11Sc', className: '11', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 5, period: 7, classKey: '12Sc', className: '12', section: 'Sc', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Ms. Supriya Chettri', day: 5, period: 9, classKey: '5A', className: '5', section: 'A', subject: 'Science', type: 'SUBJECT' },

  // Ms. Anupama Gurung (28 Periods)
  { teacher: 'Ms. Anupama Gurung', day: 1, period: 1, classKey: '5B', className: '5', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 1, period: 3, classKey: '6B', className: '6', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 1, period: 4, classKey: '8A', className: '8', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 1, period: 6, classKey: '5A', className: '5', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 1, period: 7, classKey: '6A', className: '6', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 1, period: 8, classKey: '7A', className: '7', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 2, period: 1, classKey: '5B', className: '5', section: 'B', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Ms. Anupama Gurung', day: 2, period: 3, classKey: '6B', className: '6', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 2, period: 5, classKey: '7B', className: '7', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 2, period: 7, classKey: '8B', className: '8', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Ms. Anupama Gurung', day: 3, period: 1, classKey: '5B', className: '5', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 3, period: 2, classKey: '8B', className: '8', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 3, period: 4, classKey: '8A', className: '8', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 3, period: 6, classKey: '5A', className: '5', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 3, period: 7, classKey: '6A', className: '6', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 3, period: 8, classKey: '7A', className: '7', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 4, period: 1, classKey: '7B', className: '7', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 4, period: 2, classKey: '5A', className: '5', section: 'A', subject: 'Moral Science (M.Sc.)', type: 'M.SC.' },
  { teacher: 'Ms. Anupama Gurung', day: 4, period: 6, classKey: '6B', className: '6', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 4, period: 8, classKey: '8B', className: '8', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 4, period: 9, classKey: '5B', className: '5', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 5, period: 1, classKey: '5B', className: '5', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 5, period: 2, classKey: '7B', className: '7', section: 'B', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 5, period: 4, classKey: '8A', className: '8', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 5, period: 6, classKey: '5A', className: '5', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 5, period: 7, classKey: '6A', className: '6', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },
  { teacher: 'Ms. Anupama Gurung', day: 5, period: 8, classKey: '7A', className: '7', section: 'A', subject: '2L Nepali', type: 'SUBJECT' },

  // Mr. Rajesh Singh (30 Periods)
  { teacher: 'Mr. Rajesh Singh', day: 1, period: 1, classKey: '6A', className: '6', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 1, period: 3, classKey: '7B', className: '7', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 1, period: 5, classKey: '5A', className: '5', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 1, period: 6, classKey: '7B', className: '7', section: 'B', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rajesh Singh', day: 1, period: 8, classKey: '5B', className: '5', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 1, period: 9, classKey: '6A', className: '6', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 2, period: 1, classKey: '6A', className: '6', section: 'A', subject: 'Assembly or Moral Science', type: 'ASSEMBLY' },
  { teacher: 'Mr. Rajesh Singh', day: 2, period: 4, classKey: '5B', className: '5', section: 'B', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 2, period: 5, classKey: '5B', className: '5', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 2, period: 7, classKey: '7A', className: '7', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 2, period: 8, classKey: '6B', className: '6', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 2, period: 9, classKey: 'Senior', className: 'Senior', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 1, classKey: '6A', className: '6', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 2, classKey: '7B', className: '7', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 4, classKey: '5A', className: '5', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 6, classKey: '6B', className: '6', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 7, classKey: '7A', className: '7', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 8, classKey: '12H', className: '12', section: 'H', subject: 'Library', type: 'LIBRARY', notes: 'With Mr. Ajoy Gurung' },
  { teacher: 'Mr. Rajesh Singh', day: 3, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 4, period: 1, classKey: '6A', className: '6', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 4, period: 3, classKey: '5A', className: '5', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 4, period: 4, classKey: '5A', className: '5', section: 'A', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 4, period: 7, classKey: '7A', className: '7', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 4, period: 8, classKey: '5B', className: '5', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 5, period: 2, classKey: '7A', className: '7', section: 'A', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rajesh Singh', day: 5, period: 3, classKey: '6A', className: '6', section: 'A', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rajesh Singh', day: 5, period: 4, classKey: '5A', className: '5', section: 'A', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rajesh Singh', day: 5, period: 6, classKey: '6B', className: '6', section: 'B', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rajesh Singh', day: 5, period: 7, classKey: '7B', className: '7', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rajesh Singh', day: 5, period: 8, classKey: '5B', className: '5', section: 'B', subject: 'Robotics', type: 'ROBOTICS' },
  // Mr. Sagar Gurung (28 Periods)
  { teacher: 'Mr. Sagar Gurung', day: 1, period: 1, classKey: '6B', className: '6', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 1, period: 2, classKey: '6A', className: '6', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 1, period: 4, classKey: '7A', className: '7', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 1, period: 5, classKey: '6A', className: '6', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 1, period: 7, classKey: '5A', className: '5', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 1, period: 8, classKey: '7B', className: '7', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 2, period: 1, classKey: '6B', className: '6', section: 'B', subject: 'Assembly or Moral Science', type: 'ASSEMBLY', notes: 'Class 6B Class Teacher Period' },
  { teacher: 'Mr. Sagar Gurung', day: 2, period: 3, classKey: '5A', className: '5', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 2, period: 4, classKey: '7A', className: '7', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 2, period: 6, classKey: '5B', className: '5', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 2, period: 7, classKey: '6B', className: '6', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 2, period: 9, classKey: 'Middle', className: 'Middle', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Sagar Gurung', day: 3, period: 1, classKey: '6B', className: '6', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 3, period: 2, classKey: '6A', className: '6', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 3, period: 5, classKey: '6B', className: '6', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 3, period: 6, classKey: '5B', className: '5', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 3, period: 8, classKey: '6A', className: '6', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 4, period: 1, classKey: '6B', className: '6', section: 'B', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 4, period: 5, classKey: '6A', className: '6', section: 'A', subject: 'History', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 4, period: 7, classKey: '5A', className: '5', section: 'A', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 4, period: 8, classKey: '7B', className: '7', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 4, period: 9, classKey: '6B', className: '6', section: 'B', subject: 'Special Activity', type: 'SPECIAL ACTIVITY', notes: 'Class 6B Class Teacher Activity' },
  { teacher: 'Mr. Sagar Gurung', day: 5, period: 1, classKey: '6B', className: '6', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 5, period: 3, classKey: '7A', className: '7', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 5, period: 4, classKey: '7B', className: '7', section: 'B', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 5, period: 6, classKey: '6A', className: '6', section: 'A', subject: 'English 2', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 5, period: 7, classKey: '5B', className: '5', section: 'B', subject: 'Mathematics', type: 'SUBJECT' },
  { teacher: 'Mr. Sagar Gurung', day: 5, period: 9, classKey: '6A', className: '6', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY' },

  // Mr. Rahul Chettri (28 Periods)
  { teacher: 'Mr. Rahul Chettri', day: 1, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 1, period: 2, classKey: '8B', className: '8', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 1, period: 7, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 1, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 1, period: 9, classKey: '6B', className: '6', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 2, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'Assembly or Moral Science', type: 'ASSEMBLY', notes: 'Class 8A Class Teacher Period' },
  { teacher: 'Mr. Rahul Chettri', day: 2, period: 2, classKey: '6A', className: '6', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 2, period: 6, classKey: '6B', className: '6', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 2, period: 7, classKey: '7B', className: '7', section: 'B', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 2, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 2, period: 9, classKey: 'Middle', className: 'Middle', section: '', subject: 'Weekly Test', type: 'TEST' },
  { teacher: 'Mr. Rahul Chettri', day: 3, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 3, period: 3, classKey: '8B', className: '8', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 3, period: 4, classKey: '6B', className: '6', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 3, period: 5, classKey: '6A', className: '6', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 3, period: 7, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 3, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 4, period: 1, classKey: '8A', className: '8', section: 'A', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 4, period: 2, classKey: '8B', className: '8', section: 'B', subject: 'Computer Applications', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 4, period: 3, classKey: '7A', className: '7', section: 'A', subject: 'General Knowledge', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 4, period: 4, classKey: '6B', className: '6', section: 'B', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 4, period: 7, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 4, period: 8, classKey: '10', className: '10', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 5, period: 1, classKey: '8B', className: '8', section: 'B', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rahul Chettri', day: 5, period: 2, classKey: '6A', className: '6', section: 'A', subject: 'Chemistry', type: 'SUBJECT' },
  { teacher: 'Mr. Rahul Chettri', day: 5, period: 5, classKey: '8A', className: '8', section: 'A', subject: 'Robotics', type: 'ROBOTICS' },
  { teacher: 'Mr. Rahul Chettri', day: 5, period: 8, classKey: '9', className: '9', section: '', subject: 'Computer Applications', type: 'SUBJECT', notes: 'Parallel Elective' },
  { teacher: 'Mr. Rahul Chettri', day: 5, period: 9, classKey: '8A', className: '8', section: 'A', subject: 'Special Activity', type: 'SPECIAL ACTIVITY', notes: 'Class 8A Class Teacher Activity' },
];

async function seed() {
  console.log('--- 1. Ensuring Routine Version Exists ---');
  const allSchedules = [...subodhSchedule, ...otherTeachersSchedule];

  // Deduplicate and validate slot allocations
  const seenTeacherSlot = new Set();
  const seenClassSlot = new Map();
  const dedupedSchedules = [];

  for (const s of allSchedules) {
    const tKey = `${s.teacher}_${s.day}_${s.period}`;
    if (seenTeacherSlot.has(tKey)) {
      console.warn(`WARNING: Dropping teacher clash for ${tKey} (${s.subject})`);
      continue;
    }
    seenTeacherSlot.add(tKey);

    const cKey = `${s.classKey}_${s.day}_${s.period}`;
    if (seenClassSlot.has(cKey)) {
      const existing = seenClassSlot.get(cKey);
      const isCoTeachingLibrary = (existing.type === 'LIBRARY' && s.type === 'LIBRARY');
      const isParallelElectiveArtMusic = (
        (s.className === '9' || s.className === '10') &&
        ((existing.subject === 'Art' && s.subject === 'Music') || (existing.subject === 'Music' && s.subject === 'Art'))
      );
      const isParallelSectionSplit = (s.className === '5' && s.section === 'B' && s.day === 5 && s.period === 9);
      const isCoSupervisionTest = (existing.type === 'TEST' && s.type === 'TEST');

      if (!isCoTeachingLibrary && !isParallelElectiveArtMusic && !isParallelSectionSplit && !isCoSupervisionTest) {
        console.warn(`WARNING: Dropping class clash for ${cKey} (${s.teacher} - ${s.subject} vs ${existing.teacher} - ${existing.subject})`);
        continue;
      }
    } else {
      seenClassSlot.set(cKey, s);
    }

    dedupedSchedules.push(s);
  }

  const uniqueTeachers = [...new Set(dedupedSchedules.map(s => s.teacher))];
  const uniqueClasses = [...new Set(dedupedSchedules.map(s => s.classKey))];

  const versionPayload = {
    id: VERSION_ID,
    academic_year: '2026',
    campus_name: 'Senior School',
    version_code: 'V1',
    version_num: 1,
    title: 'Senior School Master Routine 2026–27',
    status: 'PUBLISHED',
    change_reason: 'Official Term Schedule finalized by Principal with Subodh weekly routine',
    summary_stats: {
      totalTeachers: uniqueTeachers.length,
      totalClasses: uniqueClasses.length,
      totalEntries: dedupedSchedules.length,
      conflicts: 0,
      warnings: 0
    }
  };

  const vRes = await fetch(`${baseUrl}/routine_versions`, {
    method: 'POST',
    headers: {
      'apikey': anon,
      'Authorization': 'Bearer ' + service,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(versionPayload)
  });
  console.log('Version Upsert Response:', vRes.status);

  console.log('\n--- 2. Clearing Existing Entries for Version ---');
  await fetch(`${baseUrl}/master_routine?version_id=eq.${VERSION_ID}`, {
    method: 'DELETE',
    headers: { 'apikey': anon, 'Authorization': 'Bearer ' + service }
  });

  console.log('\n--- 3. Mapping and Inserting Master Entries ---');
  const allEntries = dedupedSchedules.map(s => {
    const pInfo = PERIOD_TIMES[s.period];
    return {
      version_id: VERSION_ID,
      academic_year: '2026',
      day_of_week: s.day,
      period_num: s.period,
      period_name: pInfo.name,
      start_time: pInfo.start,
      end_time: pInfo.end,
      teacher_id: TEACHER_MAP[s.teacher] || TEACHER_MAP['Subodh'],
      teacher_name: s.teacher,
      class_id: CLASS_MAP[s.classKey] || CLASS_MAP['7A'],
      class_name: s.className,
      section: s.section,
      subject_name: s.subject,
      entry_type: s.type,
      notes: s.notes || null
    };
  });

  console.log(`Inserting ${allEntries.length} total entries into master_routine (${subodhSchedule.length} for Subodh)...`);
  const insertRes = await fetch(`${baseUrl}/master_routine`, {
    method: 'POST',
    headers: {
      'apikey': anon,
      'Authorization': 'Bearer ' + service,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(allEntries)
  });

  if (!insertRes.ok) {
    console.error('Insert failed:', await insertRes.text());
    process.exit(1);
  }

  const inserted = await insertRes.json();
  console.log(`✅ Successfully inserted ${inserted.length} total entries in PostgreSQL!`);

  // Verify Subodh specifically
  const checkSubodh = await fetch(`${baseUrl}/master_routine?teacher_id=eq.${TEACHER_MAP['Subodh']}&select=*`, {
    headers: { 'apikey': anon, 'Authorization': 'Bearer ' + service }
  });
  const subodhData = await checkSubodh.json();
  console.log(`✅ Verified: ${subodhData.length} entries confirmed for Subodh.`);

  // Verify Dhirendra Lama specifically
  const checkDL = await fetch(`${baseUrl}/master_routine?teacher_id=eq.${TEACHER_MAP['Dhirendra Lama']}&select=*`, {
    headers: { 'apikey': anon, 'Authorization': 'Bearer ' + service }
  });
  const dlData = await checkDL.json();
  console.log(`✅ Verified: ${dlData.length} entries confirmed for Mr. Dhirendra Lama (Target: 30).`);

  // Verify Ajoy Gurung specifically
  const checkAG = await fetch(`${baseUrl}/master_routine?teacher_id=eq.${TEACHER_MAP['Ajoy Gurung']}&select=*`, {
    headers: { 'apikey': anon, 'Authorization': 'Bearer ' + service }
  });
  const agData = await checkAG.json();
  console.log(`✅ Verified: ${agData.length} entries confirmed for Mr. Ajoy Gurung (Target: 21).`);

  // Print Subodh's routine by day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  days.forEach((dayName, dIdx) => {
    const dNum = dIdx + 1;
    const dayEntries = subodhData.filter(e => e.day_of_week === dNum).sort((a,b) => a.period_num - b.period_num);
    console.log(`\n${dayName} (${dayEntries.length} periods for Subodh):`);
    dayEntries.forEach(e => {
      console.log(`  P${e.period_num} (${e.start_time}-${e.end_time}): Class ${e.class_name} ${e.section || ''} - ${e.subject_name} [${e.entry_type}]`);
    });
  });
}

seed().catch(console.error);
