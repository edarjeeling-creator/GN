const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].trim();
const anonKey = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_KEY')).split('=')[1].trim();

const token = process.argv[2];
if (!token) {
  console.error("Please provide a valid JWT token as the first argument.");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  global: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
});

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function buildPayload(personId, time) {
  return {
    person_type: 'student',
    person_id: personId,
    status: 'Present',
    device_name: 'Test-Device',
    gate: 'Main Gate',
    scan_time: time
  };
}

async function runConcurrencyTest(iterations = 20) {
  console.log(`\n--- Running Concurrent Insert Test (${iterations} iterations) ---`);
  let successes = 0;
  
  for (let i = 0; i < iterations; i++) {
    const scanTime = new Date().toISOString();
    const testStudentId = randomUUID();
    
    // Fire two requests simultaneously
    const p1 = supabase.from('attendance_logs').insert(buildPayload(testStudentId, scanTime)).select().single();
    const p2 = supabase.from('attendance_logs').insert(buildPayload(testStudentId, scanTime)).select().single();
    
    const [res1, res2] = await Promise.all([p1, p2]);
    
    // One must succeed (no error), one must fail with 23505
    const errorCodes = [res1.error?.code, res2.error?.code].filter(Boolean);
    const hasSuccess = (!res1.error && res2.error) || (res1.error && !res2.error);
    const hasDuplicate = errorCodes.includes('23505');
    
    if (hasSuccess && hasDuplicate && errorCodes.length === 1) {
      successes++;
      process.stdout.write('.');
    } else {
      console.error(`\nIteration ${i} FAILED:`, { res1: res1.error, res2: res2.error });
      process.exit(1);
    }
  }
  
  console.log(`\n✅ Passed: ${successes}/${iterations} concurrent pairs resulted in exactly 1 success and 1 DUPLICATE (23505).`);
}

async function runDifferentStudentsTest() {
  console.log(`\n--- Running Unrelated Students Concurrency Test ---`);
  const scanTime = new Date().toISOString();
  
  const p1 = supabase.from('attendance_logs').insert(buildPayload(randomUUID(), scanTime)).select().single();
  const p2 = supabase.from('attendance_logs').insert(buildPayload(randomUUID(), scanTime)).select().single();
  const p3 = supabase.from('attendance_logs').insert(buildPayload(randomUUID(), scanTime)).select().single();
  
  const results = await Promise.all([p1, p2, p3]);
  const hasErrors = results.some(r => r.error);
  
  if (hasErrors) {
    console.error("FAILED: Different students should not block each other.", results.map(r => r.error));
    process.exit(1);
  }
  
  console.log("✅ Passed: Different students can be processed simultaneously.");
}

async function runBoundaryTests() {
  console.log(`\n--- Running 3-Minute Boundary Tests ---`);
  const studentId = randomUUID();
  
  // Test 1: Immediately repeated
  const t1 = new Date();
  const t2 = new Date(t1.getTime() + 10 * 1000); // +10s
  
  await supabase.from('attendance_logs').insert(buildPayload(studentId, t1.toISOString()));
  const res2 = await supabase.from('attendance_logs').insert(buildPayload(studentId, t2.toISOString()));
  if (res2.error?.code !== '23505') {
    console.error("FAILED: +10s scan was not rejected.", res2.error);
    process.exit(1);
  }
  console.log("✅ Passed: Immediately repeated scan rejected.");

  // Test 2: Within window (2m 59s)
  const t3 = new Date(t1.getTime() + (2 * 60 * 1000) + (59 * 1000));
  const res3 = await supabase.from('attendance_logs').insert(buildPayload(studentId, t3.toISOString()));
  if (res3.error?.code !== '23505') {
    console.error("FAILED: +2m59s scan was not rejected.", res3.error);
    process.exit(1);
  }
  console.log("✅ Passed: +2m 59s scan rejected.");

  // Test 3: Exact boundary (3m 00s)
  const t4 = new Date(t1.getTime() + (3 * 60 * 1000));
  const res4 = await supabase.from('attendance_logs').insert(buildPayload(studentId, t4.toISOString()));
  if (res4.error?.code !== '23505') {
    console.error("FAILED: Exactly +3m00s scan was not rejected.", res4.error);
    process.exit(1);
  }
  console.log("✅ Passed: Exactly +3m 00s boundary is inclusive and rejected.");

  // Test 4: Outside window (3m 01s)
  const t5 = new Date(t1.getTime() + (3 * 60 * 1000) + 1000);
  const res5 = await supabase.from('attendance_logs').insert(buildPayload(studentId, t5.toISOString()));
  if (res5.error) {
    console.error("FAILED: +3m01s scan was rejected but should be allowed.", res5.error);
    process.exit(1);
  }
  console.log("✅ Passed: +3m 01s scan allowed.");
}

async function runCancelledTest() {
  console.log(`\n--- Running Cancelled Record Test ---`);
  const studentId = randomUUID();
  const t1 = new Date().toISOString();
  
  await supabase.from('attendance_logs').insert({
    ...buildPayload(studentId, t1),
    status: 'Cancelled'
  });
  
  const res2 = await supabase.from('attendance_logs').insert(buildPayload(studentId, t1));
  if (res2.error) {
    console.error("FAILED: Cancelled record blocked a new scan.", res2.error);
    process.exit(1);
  }
  console.log("✅ Passed: Cancelled record correctly ignored.");
}

async function main() {
  try {
    await runConcurrencyTest(50);
    await runDifferentStudentsTest();
    await runBoundaryTests();
    await runCancelledTest();
    console.log("\n🎉 All automated tests PASSED!");
  } catch(e) {
    console.error("Test suite aborted:", e);
  }
}

main();
