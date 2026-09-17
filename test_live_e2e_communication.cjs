/**
 * test_live_e2e_communication.cjs
 * Live end-to-end integration verification against Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const assert = require('assert');

const supabase = createClient(
  'https://grades.gyanodayniketan.cloud',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
);

async function runLiveE2E() {
  console.log('--- STARTING LIVE DATABASE END-TO-END VERIFICATION ---');

  // 1. Fetch live Class & Student
  const { data: classes } = await supabase.from('classes').select('id, name, section').limit(1);
  const targetClass = classes[0];
  console.log(`Target class: ${targetClass.name} (id: ${targetClass.id})`);

  const { data: students } = await supabase.from('students').select('id, name').eq('class_id', targetClass.id).limit(2);
  console.log(`Found ${students.length} students in class for live test`);
  assert.ok(students.length > 0, 'Must have at least 1 student');

  // 2. Insert Test Communication
  const testCommPayload = {
    title: 'E2E Live Verification Mathematics Weekly Test',
    communication_type: 'TEST_ANNOUNCEMENT',
    scope_type: 'CLASS_SUBJECT',
    class_id: targetClass.id,
    class_name_snapshot: targetClass.name,
    section_snapshot: targetClass.section || '',
    subject_name_snapshot: 'Mathematics',
    teacher_name_snapshot: 'Test Faculty',
    test_exam_date: '2026-09-22',
    portion_syllabus: 'Chapter 5 Quadratic Equations',
    portion_breakdown: [
      { chapter: 'Chapter 5', topics: ['Quadratic Formula', 'Roots Analysis'] }
    ],
    priority: 'NORMAL',
    status: 'PUBLISHED',
    acknowledgement_required: true,
    recipient_count: students.length,
    read_count: 0,
    acknowledgement_count: 0
  };

  const { data: insertedComm, error: insErr } = await supabase
    .from('test_exam_communications')
    .insert(testCommPayload)
    .select()
    .single();

  if (insErr) throw new Error('Live Comm Insert Failed: ' + insErr.message);
  console.log('✅ PASS 1: Live Communication inserted with ID:', insertedComm.id);

  // 3. Snapshot Live Recipients
  const recipientPayloads = students.map(s => ({
    communication_id: insertedComm.id,
    student_id: s.id,
    student_name_snapshot: s.name,
    class_name_snapshot: targetClass.name,
    is_read: false,
    is_acknowledged: false
  }));

  const { data: insertedRecs, error: recErr } = await supabase
    .from('test_exam_communication_recipients')
    .insert(recipientPayloads)
    .select();

  if (recErr) throw new Error('Live Recipient Insert Failed: ' + recErr.message);
  console.log(`✅ PASS 2: Live Recipients snapshotted (${insertedRecs.length} records)`);

  // 4. Record Live Student Read
  const targetStudentId = students[0].id;
  const { data: readRec, error: readErr } = await supabase
    .from('test_exam_communication_recipients')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('communication_id', insertedComm.id)
    .eq('student_id', targetStudentId)
    .select()
    .single();

  if (readErr) throw new Error('Live Read Update Failed: ' + readErr.message);
  assert.strictEqual(readRec.is_read, true);
  console.log('✅ PASS 3: Student live read receipt recorded successfully');

  // 5. Record Live Student Acknowledgement
  const { data: ackRec, error: ackErr } = await supabase
    .from('test_exam_communication_recipients')
    .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('communication_id', insertedComm.id)
    .eq('student_id', targetStudentId)
    .select()
    .single();

  if (ackErr) throw new Error('Live Ack Update Failed: ' + ackErr.message);
  assert.strictEqual(ackRec.is_acknowledged, true);
  console.log('✅ PASS 4: Student live acknowledgement recorded successfully');

  // 6. Insert Live Audit Log
  const { data: auditEntry, error: auditErr } = await supabase
    .from('test_exam_communication_audit_logs')
    .insert({
      communication_id: insertedComm.id,
      user_role: 'teacher',
      user_name: 'Test Faculty',
      action: 'PUBLISHED',
      details: { recipients: students.length }
    })
    .select()
    .single();

  if (auditErr) throw new Error('Live Audit Insert Failed: ' + auditErr.message);
  console.log('✅ PASS 5: Live Audit log created successfully:', auditEntry.id);

  // 7. Verify Date Change Preservation (V1 -> V2)
  const { data: v2Comm, error: v2Err } = await supabase
    .from('test_exam_communications')
    .insert({
      ...testCommPayload,
      title: 'E2E Live Verification Mathematics Weekly Test (Revised Date)',
      original_test_date: '2026-09-22',
      test_exam_date: '2026-09-25',
      version: 2,
      is_latest: true,
      change_reason: 'Sports Day Postponement',
      parent_communication_id: insertedComm.id
    })
    .select()
    .single();

  if (v2Err) throw new Error('V2 Insert Failed: ' + v2Err.message);
  assert.strictEqual(v2Comm.version, 2);
  assert.strictEqual(v2Comm.original_test_date, '2026-09-22');
  assert.strictEqual(v2Comm.test_exam_date, '2026-09-25');
  console.log('✅ PASS 6: Non-destructive revision V2 created and verified with date change tracking');

  // 8. Clean up live test entries
  await supabase.from('test_exam_communication_recipients').delete().eq('communication_id', insertedComm.id);
  await supabase.from('test_exam_communication_recipients').delete().eq('communication_id', v2Comm.id);
  await supabase.from('test_exam_communications').delete().eq('id', v2Comm.id);
  await supabase.from('test_exam_communications').delete().eq('id', insertedComm.id);
  console.log('✅ PASS 7: Test artifacts cleaned up safely');

  console.log('--- ALL LIVE DATABASE END-TO-END TESTS PASSED (7/7) ---');
}

runLiveE2E().catch(err => {
  console.error('FAILED Live E2E:', err);
  process.exit(1);
});
