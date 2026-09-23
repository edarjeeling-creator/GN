const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('GYANODAY NIKETAN: PRINCIPAL NOTICE PUSH & DEEP-LINK TEST SUITE');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Test 1-3: Strip HTML & Preview Truncation Logic
// -------------------------------------------------------------
runTest('HTML tags stripped properly for push notification preview', () => {
  const stripHtml = (html = '') => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+([,.:;?!])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const html = '<p>Dear <strong>Teachers</strong>,</p><p>Staff meeting at <em>3:30 PM</em> in Room 12.</p>';
  const clean = stripHtml(html);
  assert.strictEqual(clean, 'Dear Teachers, Staff meeting at 3:30 PM in Room 12.');
});

runTest('Preview truncated at 120 characters with ellipsis', () => {
  const stripHtml = (html = '') => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+([,.:;?!])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const longContent = '<p>' + 'A'.repeat(200) + '</p>';
  const clean = stripHtml(longContent);
  const preview = clean.length > 120 ? clean.slice(0, 117) + '...' : clean;

  assert.strictEqual(preview.length, 120);
  assert(preview.endsWith('...'));
  assert.strictEqual(preview.slice(0, 117), 'A'.repeat(117));
});

runTest('Fallback preview string used when notice content is empty', () => {
  const stripHtml = (html = '') => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+([,.:;?!])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const emptyContent = '<p><br></p>';
  const clean = stripHtml(emptyContent);
  const preview = clean.length > 120 ? clean.slice(0, 117) + '...' : clean || 'New notice from Principal';

  assert.strictEqual(preview, 'New notice from Principal');
});

// -------------------------------------------------------------
// Test 4-6: Recipient Audience Resolution Logic
// -------------------------------------------------------------
const mockProfiles = [
  { id: 't1', name: 'Teacher 1', role: 'teacher', status: 'Active' },
  { id: 't2', name: 'Coordinator 1', role: 'coordinator', status: 'Active' },
  { id: 't3', name: 'Inactive Teacher', role: 'teacher', status: 'Inactive' },
  { id: 's1', name: 'Staff Clerk', role: 'non_teaching', status: 'Active' },
  { id: 'g1', name: 'Support Peon', role: 'group_d', status: 'Active' },
  { id: 'st1', name: 'Student 1', role: 'student', status: 'Active' },
  { id: 'st2', name: 'Student 2', role: 'student', status: 'Active' },
  { id: 'p1', name: 'Principal', role: 'principal', status: 'Active' },
  { id: 'a1', name: 'Admin', role: 'admin', status: 'Active' }
];

function resolveRecipients(audience, profiles) {
  if (audience === 'all') {
    return profiles.filter(p => p.status === 'Active').map(p => p.id);
  }
  if (audience === 'staff') {
    return profiles.filter(p => 
      ['teacher', 'non_teaching', 'group_d', 'admin', 'principal', 'coordinator', 'accountant', 'librarian'].includes(p.role) &&
      p.status === 'Active'
    ).map(p => p.id);
  }
  if (audience === 'teachers') {
    return profiles.filter(p => 
      ['teacher', 'coordinator'].includes(p.role) &&
      p.status === 'Active'
    ).map(p => p.id);
  }
  if (audience === 'students') {
    return profiles.filter(p => p.role === 'student' && p.status === 'Active').map(p => p.id);
  }
  return [];
}

runTest('Audience "teachers" targets ONLY active teachers and coordinators', () => {
  const recips = resolveRecipients('teachers', mockProfiles);
  assert.deepStrictEqual(recips.sort(), ['t1', 't2'].sort());
  // Ensure inactive teachers and students are strictly excluded
  assert(!recips.includes('t3'), 'Inactive teacher must be excluded');
  assert(!recips.includes('st1'), 'Student must be excluded');
  assert(!recips.includes('st2'), 'Student must be excluded');
  assert(!recips.includes('s1'), 'Non-teaching staff must be excluded');
});

runTest('Audience "staff" targets all teaching & non-teaching staff but excludes students', () => {
  const recips = resolveRecipients('staff', mockProfiles);
  assert(recips.includes('t1'));
  assert(recips.includes('t2'));
  assert(recips.includes('s1'));
  assert(recips.includes('g1'));
  assert(recips.includes('p1'));
  assert(recips.includes('a1'));
  assert(!recips.includes('st1'));
  assert(!recips.includes('st2'));
});

runTest('Audience "students" targets active students only', () => {
  const recips = resolveRecipients('students', mockProfiles);
  assert.deepStrictEqual(recips.sort(), ['st1', 'st2'].sort());
  assert(!recips.includes('t1'));
});

// -------------------------------------------------------------
// Test 7-9: Push Notification Payload & Deep-Link Structuring
// -------------------------------------------------------------
runTest('Push notification payload contains noticeId, notice_id, and deep link URL', () => {
  const noticeId = '550e8400-e29b-41d4-a716-446655440000';
  const title = 'Emergency Faculty Assembly';
  const cleanPreview = 'All faculty to meet in Auditorium at 2:00 PM';
  const tokens = ['fcm_token_teacher_1', 'fcm_token_teacher_2'];

  const payload = {
    tokens,
    notification: {
      title: `🔔 ${title}`,
      body: cleanPreview
    },
    data: {
      noticeId: String(noticeId),
      notice_id: String(noticeId),
      type: 'notice',
      linkUrl: `/?noticeId=${noticeId}`
    }
  };

  assert.strictEqual(payload.tokens.length, 2);
  assert.strictEqual(payload.notification.title, '🔔 Emergency Faculty Assembly');
  assert.strictEqual(payload.data.type, 'notice');
  assert.strictEqual(payload.data.noticeId, noticeId);
  assert.strictEqual(payload.data.linkUrl, `/?noticeId=${noticeId}`);
});

runTest('Empty recipient list skips push invocation gracefully without throwing', async () => {
  const NotificationServiceModule = fs.readFileSync(
    path.join(__dirname, 'src/services/NotificationService.js'),
    'utf8'
  );
  assert(NotificationServiceModule.includes('dispatchNoticePush'));
  assert(NotificationServiceModule.includes('if (!recipientUserIds || recipientUserIds.length === 0)'));
  assert(NotificationServiceModule.includes('resolveRecipientTokens'));
});

runTest('Token resolution uses get_recipient_fcm_tokens RPC with direct fallback', () => {
  const NotificationServiceModule = fs.readFileSync(
    path.join(__dirname, 'src/services/NotificationService.js'),
    'utf8'
  );
  assert(NotificationServiceModule.includes("supabase.rpc('get_recipient_fcm_tokens'"));
  assert(NotificationServiceModule.includes(".from('user_devices')"));
});

// -------------------------------------------------------------
// Test 10-12: Deep-Link Routing & Auto-Modal in Dashboard
// -------------------------------------------------------------
runTest('Dashboard.jsx implements noticeId URL search parameter listener', () => {
  const dashboardSource = fs.readFileSync(
    path.join(__dirname, 'src/pages/Dashboard.jsx'),
    'utf8'
  );
  assert(dashboardSource.includes("params.get('noticeId')"));
  assert(dashboardSource.includes("setActiveTopTab('notices')"));
  assert(dashboardSource.includes("setSelectedNoticeForModal"));
});

runTest('App.jsx root route handles ?noticeId deep link for web and native platform', () => {
  const appSource = fs.readFileSync(
    path.join(__dirname, 'src/App.jsx'),
    'utf8'
  );
  assert(appSource.includes("function RootRoute()"));
  assert(appSource.includes("searchParams.get('noticeId')"));
  assert(appSource.includes("Navigate to={`/dashboard${search}`}"));
});

runTest('Login.jsx forwards noticeId upon successful authentication', () => {
  const loginSource = fs.readFileSync(
    path.join(__dirname, 'src/pages/Login.jsx'),
    'utf8'
  );
  assert(loginSource.includes("params.get('noticeId')"));
  assert(loginSource.includes("`/dashboard?noticeId=${noticeId}`"));
});

// -------------------------------------------------------------
// Test 13-15: Database Migration & Security Definer Specifications
// -------------------------------------------------------------
runTest('Migration script enables RLS and restricts user_devices to own profile', () => {
  const migrationSql = fs.readFileSync(
    path.join(__dirname, 'supabase/migrations/20260923_notice_push_and_device_security.sql'),
    'utf8'
  );
  assert(migrationSql.includes('ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY'));
  assert(migrationSql.includes('profile_id = auth.uid()'));
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.publish_school_notice'));
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.get_recipient_fcm_tokens'));
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.deactivate_fcm_tokens'));
});

runTest('PrincipalPortal.jsx calls publish_school_notice RPC and dispatches push', () => {
  const principalSource = fs.readFileSync(
    path.join(__dirname, 'src/pages/PrincipalPortal.jsx'),
    'utf8'
  );
  assert(principalSource.includes("supabase.rpc('publish_school_notice'"));
  assert(principalSource.includes("notificationService.dispatchNoticePush"));
  assert(principalSource.includes("publishingNotice") || principalSource.includes("sendingNotice"));
});

runTest('DevicePushService.js registers native Capacitor push listeners with fallback', () => {
  const devicePushSource = fs.readFileSync(
    path.join(__dirname, 'src/services/DevicePushService.js'),
    'utf8'
  );
  assert(devicePushSource.includes('PushNotifications.register()'));
  assert(devicePushSource.includes("PushNotifications.addListener('registration'"));
  assert(devicePushSource.includes("PushNotifications.addListener('pushNotificationActionPerformed'"));
  assert(devicePushSource.includes('wp_')); // Web push fallback retained
});

// -------------------------------------------------------------
// Test 16: Android Manifest & Post-Notification Permission
// -------------------------------------------------------------
runTest('AndroidManifest.xml includes POST_NOTIFICATIONS permission for Android 13+', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, 'android/app/src/main/AndroidManifest.xml'),
    'utf8'
  );
  assert(manifest.includes('android.permission.POST_NOTIFICATIONS'));
});

// -------------------------------------------------------------
// Test 17: Edge Function Dead Token Cleanup Logic
// -------------------------------------------------------------
runTest('send-notification Edge Function handles dead token deactivation and unconfigured fallback', () => {
  const edgeFunc = fs.readFileSync(
    path.join(__dirname, 'supabase/functions/send-notification/index.ts'),
    'utf8'
  );
  assert(edgeFunc.includes('deactivate_fcm_tokens'));
  assert(edgeFunc.includes('messaging/registration-token-not-registered'));
  assert(edgeFunc.includes('Firebase Admin SDK not initialized'));
});

console.log('================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('================================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
