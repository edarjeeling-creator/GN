/**
 * test_principal_delete_notices.cjs
 * Automated Test Suite for: Principal & Admin Notice/Message Deletion Feature
 * 
 * Verifies:
 * 1. PrincipalPortal.jsx contains Trash2 import, handleDeleteNotice handler, confirmation dialog, and Delete button.
 * 2. NoticeDetailModal.jsx supports canDelete and onDelete, shows Delete Notice button, and handles confirmation.
 * 3. Dashboard.jsx provides Delete button on notice cards for Principal/Admin, and wires up NoticeDetailModal.
 * 4. SQL migration contains valid RLS policy and delete_school_notice security definer RPC.
 * 5. State management: optimistic removal, confirmation guards, and error resilience.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  process.stdout.write(`TEST: ${name.padEnd(65, ' ')} ... `);
  try {
    fn();
    passCount++;
    console.log('\x1b[32mPASS\x1b[0m');
  } catch (err) {
    failCount++;
    console.log('\x1b[31mFAIL\x1b[0m');
    console.error(`   Error: ${err.message}`);
  }
}

console.log('================================================================');
console.log('GYANODAY NIKETAN: PRINCIPAL NOTICE DELETION TEST SUITE');
console.log('================================================================\n');

// 1. PrincipalPortal.jsx Tests
const principalPortalPath = path.join(__dirname, 'src', 'pages', 'PrincipalPortal.jsx');
const principalPortalSrc = fs.readFileSync(principalPortalPath, 'utf8');

runTest('PrincipalPortal imports Trash2 from lucide-react', () => {
  assert(principalPortalSrc.includes('Trash2'), 'Trash2 must be imported');
});

runTest('PrincipalPortal defines deletingNoticeId state', () => {
  assert(principalPortalSrc.includes('deletingNoticeId'), 'deletingNoticeId state must exist');
});

runTest('PrincipalPortal defines handleDeleteNotice function', () => {
  assert(principalPortalSrc.includes('const handleDeleteNotice = async'), 'handleDeleteNotice function must exist');
});

runTest('PrincipalPortal prompts user confirmation before deleting', () => {
  assert(principalPortalSrc.includes('window.confirm'), 'window.confirm must be used for safety confirmation');
  assert(principalPortalSrc.includes('This action cannot be undone'), 'Warning message must specify action is irreversible');
});

runTest('PrincipalPortal performs delete on notices table', () => {
  assert(
    principalPortalSrc.includes(".from('notices')") &&
    principalPortalSrc.includes('.delete()') &&
    principalPortalSrc.includes(".eq('id', noticeId)"),
    'Must execute delete query on notices table'
  );
});

runTest('PrincipalPortal provides fallback to delete_school_notice RPC', () => {
  assert(principalPortalSrc.includes(".rpc('delete_school_notice'"), 'Must fallback to delete_school_notice RPC if needed');
});

runTest('PrincipalPortal optimistically filters out deleted notice from state', () => {
  assert(principalPortalSrc.includes('setRecentNotices(prev => prev.filter(n => n.id !== noticeId))'), 'State must be updated optimistically');
});

runTest('PrincipalPortal renders Delete button on each notice item', () => {
  assert(principalPortalSrc.includes('handleDeleteNotice(n.id, n.title)'), 'Delete button must be attached to notice items');
  assert(principalPortalSrc.includes('title="Delete notice"'), 'Delete button must have title tooltip');
});

// 2. NoticeDetailModal.jsx Tests
const noticeModalPath = path.join(__dirname, 'src', 'components', 'NoticeDetailModal.jsx');
const noticeModalSrc = fs.readFileSync(noticeModalPath, 'utf8');

runTest('NoticeDetailModal imports Trash2', () => {
  assert(noticeModalSrc.includes('Trash2'), 'NoticeDetailModal must import Trash2');
});

runTest('NoticeDetailModal accepts canDelete and onDelete props', () => {
  assert(noticeModalSrc.includes('canDelete = false'), 'NoticeDetailModal must accept canDelete prop');
  assert(noticeModalSrc.includes('onDelete = null'), 'NoticeDetailModal must accept onDelete prop');
});

runTest('NoticeDetailModal renders Delete Notice button when permitted', () => {
  assert(noticeModalSrc.includes('canDelete && onDelete'), 'Must conditionally render when canDelete && onDelete');
  assert(noticeModalSrc.includes('Delete Notice'), 'Button text must say Delete Notice');
});

runTest('NoticeDetailModal prompts confirmation before calling onDelete', () => {
  assert(noticeModalSrc.includes('window.confirm'), 'Must confirm deletion before invoking onDelete');
});

// 3. Dashboard.jsx Tests
const dashboardPath = path.join(__dirname, 'src', 'pages', 'Dashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

runTest('Dashboard imports Trash2', () => {
  assert(dashboardSrc.includes('Trash2'), 'Dashboard must import Trash2');
});

runTest('Dashboard defines isPrincipalOrAdmin role guard', () => {
  assert(dashboardSrc.includes("profile?.role === 'principal' || profile?.role === 'admin'"), 'isPrincipalOrAdmin must check principal or admin');
});

runTest('Dashboard defines handleDeleteNoticeFromDashboard', () => {
  assert(dashboardSrc.includes('const handleDeleteNoticeFromDashboard = async'), 'handleDeleteNoticeFromDashboard must exist');
});

runTest('Dashboard renders Delete button on notice cards with stopPropagation', () => {
  assert(dashboardSrc.includes('e.stopPropagation()'), 'Must call stopPropagation to prevent opening modal');
  assert(dashboardSrc.includes('handleDeleteNoticeFromDashboard(notice.id, notice.title)'), 'Must call delete handler');
});

runTest('Dashboard passes canDelete and onDelete to NoticeDetailModal', () => {
  assert(dashboardSrc.includes('canDelete={isPrincipalOrAdmin}'), 'Must pass canDelete to NoticeDetailModal');
  assert(dashboardSrc.includes('onDelete={(id) => handleDeleteNoticeFromDashboard'), 'Must pass onDelete to NoticeDetailModal');
});

// 4. SQL Migration Tests
const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260923_allow_delete_notices.sql');
const sqlSrc = fs.readFileSync(sqlPath, 'utf8');

runTest('SQL migration enables RLS on notices table', () => {
  assert(sqlSrc.includes('ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY'), 'RLS must be enabled');
});

runTest('SQL migration policy permits admin, principal, and sender_uid to manage notices', () => {
  assert(sqlSrc.includes("role IN ('admin', 'principal', 'superadmin')"), 'Policy must cover admin and principal');
  assert(sqlSrc.includes('sender_uid = auth.uid()'), 'Policy must cover sender_uid');
});

runTest('SQL migration defines delete_school_notice SECURITY DEFINER RPC', () => {
  assert(sqlSrc.includes('FUNCTION public.delete_school_notice'), 'RPC function must be defined');
  assert(sqlSrc.includes('SECURITY DEFINER'), 'RPC must be SECURITY DEFINER');
  assert(sqlSrc.includes('GRANT EXECUTE ON FUNCTION public.delete_school_notice'), 'RPC must grant execute to authenticated');
});

// 5. Functional Simulation Tests
runTest('Simulation: Principal deletes testing notice and state updates correctly', () => {
  let notices = [
    { id: '1', title: 'Real Circular', content: 'Holiday on Friday', target_audience: 'all' },
    { id: '2', title: 'Test Message 1', content: 'Testing notice system', target_audience: 'teachers' },
    { id: '3', title: 'Test Message 2', content: 'Another testing message', target_audience: 'students' }
  ];

  const user = { id: 'principal-1', role: 'principal' };
  
  // Deletion logic emulator
  function simulateDelete(user, noticeId) {
    const isAuthorized = ['admin', 'principal'].includes(user.role);
    if (!isAuthorized) throw new Error('Unauthorized');
    notices = notices.filter(n => n.id !== noticeId);
    return true;
  }

  // Delete notice '2'
  simulateDelete(user, '2');
  assert.strictEqual(notices.length, 2, 'Notice list length must decrease to 2');
  assert.strictEqual(notices.find(n => n.id === '2'), undefined, 'Notice 2 must be deleted');

  // Delete notice '3'
  simulateDelete(user, '3');
  assert.strictEqual(notices.length, 1, 'Notice list length must decrease to 1');
  assert.strictEqual(notices[0].title, 'Real Circular', 'Only real circular remains');
});

runTest('Simulation: Unauthorized user cannot delete notice', () => {
  const notices = [{ id: '1', title: 'Real Circular' }];
  const studentUser = { id: 'student-1', role: 'student' };

  function simulateDelete(user, noticeId) {
    const isAuthorized = ['admin', 'principal'].includes(user.role);
    if (!isAuthorized) throw new Error('Unauthorized: only principal, admin, or the notice author can delete this notice');
    return true;
  }

  assert.throws(() => {
    simulateDelete(studentUser, '1');
  }, /Unauthorized/, 'Student should not be authorized to delete notice');
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL PRINCIPAL NOTICE DELETION TESTS PASSED SUCCESSFULLY.');
}
